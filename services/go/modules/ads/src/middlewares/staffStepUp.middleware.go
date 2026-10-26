package middlewares

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
	"nantty/platform/staffauth"
)

var StaffStepUpRequired = httpserver.NewApiError(http.StatusForbidden, "STEP_UP_REQUIRED", "Confirm your identity again to continue.")

func StaffWithStepUp(deployed *container.Container, permissions ...string) func(http.HandlerFunc) http.Handler {
	return func(handler http.HandlerFunc) http.Handler {
		return Staff(deployed, permissions...)(func(writer http.ResponseWriter, request *http.Request) {
			if failure := consumeStaffStepUp(deployed, request); failure != nil {
				httpserver.WriteJsonResponse(writer, failure.Status, failure)
				return
			}
			handler(writer, request)
		})
	}
}

func consumeStaffStepUp(deployed *container.Container, request *http.Request) *httpserver.ApiError {
	staff, _ := jwtauth.PrincipalFromContext(request.Context())
	token := strings.TrimSpace(request.Header.Get(staffauth.StepUpHeader))
	if token == "" || deployed.StaffStepUp == nil {
		return StaffStepUpRequired
	}
	stepUp, err := deployed.StaffStepUp.VerifyAccessTokenAndExtractPrincipal(request.Context(), token)
	if err != nil || stepUp.UserId != staff.UserId || stepUp.SessionId != staff.SessionId {
		return StaffStepUpRequired
	}
	if deployed.StepUps == nil {
		return adserrors.UpstreamUnavailable
	}
	digest := sha256.Sum256([]byte(token))
	route := request.Method + " " + request.URL.Path
	if len(route) > 200 {
		route = route[:200]
	}
	if err := deployed.StepUps.ConsumeStepUp(request.Context(), hex.EncodeToString(digest[:]), "staff:"+staff.UserId, route); err != nil {
		if failure, ok := err.(*httpserver.ApiError); ok {
			return failure
		}
		return adserrors.UpstreamUnavailable
	}
	return nil
}
