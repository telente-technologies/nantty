package controllers

import (
	"crypto/subtle"
	"net/http"

	"zudomart/modules/wallet/src/modules/payouts"
	"zudomart/platform/httpserver"
)

type InternalAccountsController struct {
	Application *payouts.Application
}

func (controller InternalAccountsController) DeletionBlockers(writer http.ResponseWriter, request *http.Request) {
	expected := controller.Application.Container.Settings.InternalApiToken
	if len(expected) < 32 || subtle.ConstantTimeCompare([]byte(expected), []byte(request.Header.Get("X-Internal-Token"))) != 1 {
		httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
		return
	}
	result, err := controller.Application.Overview.ReadDeletionBlockers(request.Context(), request.PathValue("accountId"))
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Application.Container.Resources.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}
