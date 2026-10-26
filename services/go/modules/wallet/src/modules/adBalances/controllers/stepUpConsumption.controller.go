package controllers

import (
	"encoding/json"
	"net/http"
	"regexp"
	"time"

	"nantty/modules/ledger/src/middlewares"
	"nantty/platform/httpserver"
)

var stepUpDigestPattern = regexp.MustCompile(`^[0-9a-f]{64}$`)

func (controller AdBalancesController) ConsumeStepUp(writer http.ResponseWriter, request *http.Request) {
	if !controller.requireInternalToken(writer, request) {
		return
	}
	var body struct {
		Digest string `json:"digest"`
		UserId string `json:"userId"`
		Route  string `json:"route"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(writer, request.Body, 4096)).Decode(&body); err != nil || !stepUpDigestPattern.MatchString(body.Digest) || body.UserId == "" || len(body.UserId) > 80 || body.Route == "" || len(body.Route) > 200 {
		httpserver.WriteJsonResponse(writer, http.StatusBadRequest, httpserver.NewApiError(http.StatusBadRequest, "INVALID_STEP_UP_CONSUMPTION", "digest, userId and route are required."))
		return
	}
	consumer := controller.Container.Resources.StaffVerifiers.SingleUse
	if consumer == nil {
		httpserver.WriteJsonResponse(writer, http.StatusServiceUnavailable, middlewares.ErrStepUpLedgerUnavailable)
		return
	}
	first, err := consumer.ConsumeStepUp(request.Context(), body.Digest, "user:"+body.UserId, body.Route, time.Now().Add(15*time.Minute))
	if err != nil {
		httpserver.WriteJsonResponse(writer, http.StatusServiceUnavailable, middlewares.ErrStepUpLedgerUnavailable)
		return
	}
	if !first {
		httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, middlewares.ErrStepUpReused)
		return
	}
	writer.WriteHeader(http.StatusNoContent)
}
