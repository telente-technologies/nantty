package middlewares

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"zudomart/modules/ads/src/container"
	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/platform/httpserver"
	"zudomart/platform/idempotency"
	"zudomart/platform/jwtauth"
	"zudomart/platform/staffauth"
)

const permissionRolePrefix = "perm:"

func Authenticated(deployed *container.Container) func(http.HandlerFunc) http.Handler {
	return func(handler http.HandlerFunc) http.Handler {
		return jwtauth.RequireVerifiedAccessToken(deployed.AccessVerifier)(handler)
	}
}

func Idempotent(deployed *container.Container) func(http.HandlerFunc) http.Handler {
	return func(handler http.HandlerFunc) http.Handler {
		return jwtauth.RequireVerifiedAccessToken(deployed.AccessVerifier)(requireIdempotencyKey(deployed, handler))
	}
}

func requireIdempotencyKey(deployed *container.Container, handler http.HandlerFunc) http.Handler {
	if deployed.IdempotencyStore != nil || deployed.Settings.IsProduction() {
		return idempotency.RequireIdempotencyKeyAndReplayCompletedResponses(deployed.IdempotencyStore, idempotency.MoneyMovingTimeToLive, deployed.Logger)(handler)
	}
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if !idempotency.IsValidIdempotencyKey(request.Header.Get("Idempotency-Key")) {
			httpserver.WriteJsonResponse(writer, http.StatusBadRequest, adserrors.IdempotencyKeyRequired)
			return
		}
		handler(writer, request)
	})
}

func Staff(deployed *container.Container, permissions ...string) func(http.HandlerFunc) http.Handler {
	return func(handler http.HandlerFunc) http.Handler {
		return jwtauth.RequireVerifiedAccessToken(deployed.StaffVerifier)(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			principal, _ := jwtauth.PrincipalFromContext(request.Context())
			if failure := staffauth.RefuseDisallowedStaffNetwork(request, principal.UserId); failure != nil {
				httpserver.WriteJsonResponse(writer, failure.Status, failure)
				return
			}
			if !staffHoldsAnyPermission(principal.Roles, permissions) {
				httpserver.WriteJsonResponse(writer, http.StatusForbidden, httpserver.ErrForbidden)
				return
			}
			handler(writer, request)
		}))
	}
}

func staffHoldsAnyPermission(roles []string, required []string) bool {
	for _, role := range roles {
		if role == staffauth.SuperadminRole {
			return true
		}
		if permission, found := strings.CutPrefix(role, permissionRolePrefix); found {
			for _, wanted := range required {
				if permission == wanted {
					return true
				}
			}
		}
	}
	return false
}

func StaffName(roles []string) string {
	for _, role := range roles {
		if name, found := strings.CutPrefix(role, "name:"); found {
			return name
		}
	}
	return "Staff"
}

func Internal(deployed *container.Container) func(http.HandlerFunc) http.Handler {
	return func(handler http.HandlerFunc) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			body, err := io.ReadAll(http.MaxBytesReader(writer, request.Body, 1<<20))
			if err != nil || !internalSignatureIsValid(deployed, request, body) || !internalNonceIsFresh(deployed, request) {
				httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
				return
			}
			request.Body = io.NopCloser(bytes.NewReader(body))
			handler(writer, request)
		})
	}
}

func internalSignatureIsValid(deployed *container.Container, request *http.Request, body []byte) bool {
	secret := deployed.Settings.InternalSharedSecret
	timestamp, nonce, signature := request.Header.Get("x-zudo-timestamp"), request.Header.Get("x-zudo-nonce"), request.Header.Get("x-zudo-signature")
	seconds, err := strconv.ParseInt(timestamp, 10, 64)
	if secret == "" || err != nil || len(nonce) < 16 || math.Abs(float64(deployed.Now().Unix()-seconds)) > 300 {
		return false
	}
	path := request.URL.Path
	if request.URL.RawQuery != "" {
		path += "?" + request.URL.RawQuery
	}
	bodyHash := sha256.Sum256(body)
	canonical := "v1\n" + strings.ToUpper(request.Method) + "\n" + path + "\n" + timestamp + "\n" + nonce + "\n" + hex.EncodeToString(bodyHash[:])
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(canonical))
	return hmac.Equal([]byte(signature), []byte("v1="+hex.EncodeToString(mac.Sum(nil))))
}

func internalNonceIsFresh(deployed *container.Container, request *http.Request) bool {
	seen, err := deployed.Counters.Increment(request.Context(), "nonce:"+request.Header.Get("x-zudo-nonce"), 1, 15*time.Minute)
	return err == nil && seen == 1
}
