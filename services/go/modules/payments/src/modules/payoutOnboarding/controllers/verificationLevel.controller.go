package controllers

import (
	"crypto/subtle"
	"net/http"

	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/platform/httpserver"
)

func (controller PayoutOnboardingController) GetMyVerificationLevel(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	controller.writeVerificationLevel(writer, request, principal.UserId)
}

func (controller PayoutOnboardingController) GetVerificationLevelInternal(writer http.ResponseWriter, request *http.Request) {
	expected := controller.Application.Container.Settings.InternalApiToken
	if len(expected) < 32 || subtle.ConstantTimeCompare([]byte(expected), []byte(request.Header.Get("X-Internal-Token"))) != 1 {
		httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
		return
	}
	userId := request.PathValue("userId")
	if userId == "" || len(userId) > 80 {
		controller.fail(writer, request, httpserver.ErrNotFound)
		return
	}
	controller.writeVerificationLevel(writer, request, userId)
}

func (controller PayoutOnboardingController) writeVerificationLevel(writer http.ResponseWriter, request *http.Request, userId string) {
	view, err := controller.Application.Gateway.ReadVerificationLevel(request.Context(), userId)
	if err != nil {
		controller.Application.Container.Resources.Logger.WarnContext(request.Context(), "verification level read failed", "userId", userId, "error", err)
		controller.fail(writer, request, httpserver.NewApiError(http.StatusServiceUnavailable, "VERIFICATION_UNAVAILABLE", "We couldn't confirm your verification. Try again in a moment."))
		return
	}
	writer.Header().Set("Cache-Control", "no-store")
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}

func (controller PayoutOnboardingController) StartBankValidation(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	status, err := controller.Application.Gateway.StartBankAccountValidation(request.Context(), principal.UserId)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusAccepted, map[string]string{"status": status})
}
