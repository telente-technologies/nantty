package controllers

import (
	"crypto/subtle"
	"net/http"

	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/platform/httpserver"
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
	started, err := controller.Application.Gateway.StartPayoutIdentityValidation(request.Context(), principal.UserId, request.URL.Query().Get("returnTo"))
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	writer.Header().Set("Cache-Control", "no-store")
	httpserver.WriteJsonResponse(writer, http.StatusAccepted, started)
}

func (controller PayoutOnboardingController) GetBankValidation(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	state, err := controller.Application.Gateway.RefreshPayoutIdentityValidation(request.Context(), principal.UserId)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	writer.Header().Set("Cache-Control", "no-store")
	httpserver.WriteJsonResponse(writer, http.StatusOK, state)
}

func (controller PayoutOnboardingController) GetSellingEligibilityInternal(writer http.ResponseWriter, request *http.Request) {
	expected := controller.Application.Container.Settings.InternalApiToken
	presented := request.Header.Get("x-internal-token")
	if len(expected) < 32 || subtle.ConstantTimeCompare([]byte(presented), []byte(expected)) != 1 {
		httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
		return
	}
	eligibility, err := controller.Application.Gateway.ReadSellingEligibility(request.Context(), request.PathValue("userId"))
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	writer.Header().Set("Cache-Control", "no-store")
	httpserver.WriteJsonResponse(writer, http.StatusOK, eligibility)
}
