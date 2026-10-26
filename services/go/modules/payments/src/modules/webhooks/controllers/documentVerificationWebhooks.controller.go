package controllers

import (
	"net/http"

	"nantty/platform/httpserver"
)

func (controller WebhooksController) ReceiveDocumentVerificationWebhook(writer http.ResponseWriter, request *http.Request) {
	logger := controller.Application.Container.Resources.Logger
	body, err := controller.readRawBody(writer, request)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, logger, err)
		return
	}
	if err := controller.Application.Gateway.HandleDocumentVerificationWebhook(request.Context(), body, request.Header); err != nil {
		httpserver.WriteErrorResponse(writer, request, logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]bool{"received": true})
}
