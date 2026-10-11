package controllers

import (
	"errors"
	"io"
	"net/http"
	"strings"

	"zudomart/modules/payments/src/integrations"
	"zudomart/modules/payments/src/modules/gateway"
	"zudomart/platform/httpserver"
)

const maximumWebhookBodyBytes = 1 << 20

type WebhooksController struct {
	Application *gateway.Application
}

func (controller WebhooksController) readRawBody(writer http.ResponseWriter, request *http.Request) ([]byte, error) {
	body, err := io.ReadAll(http.MaxBytesReader(writer, request.Body, maximumWebhookBodyBytes))
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		return nil, httpserver.NewApiError(http.StatusRequestEntityTooLarge, "BODY_TOO_LARGE", "The request body is too large.")
	}
	return body, err
}

func (controller WebhooksController) ReceiveProviderWebhook(writer http.ResponseWriter, request *http.Request) {
	if request.PathValue("provider") != integrations.FlutterwaveProviderName {
		httpserver.WriteErrorResponse(writer, request, controller.Application.Container.Resources.Logger, httpserver.ErrNotFound)
		return
	}
	body, err := controller.readRawBody(writer, request)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Application.Container.Resources.Logger, err)
		return
	}
	receipt, err := controller.Application.Gateway.HandleProviderWebhook(request.Context(), request.PathValue("provider"), body, request.Header)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Application.Container.Resources.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, receipt)
}

func (controller WebhooksController) ReceiveStoreRefundNotification(writer http.ResponseWriter, request *http.Request) {
	body, err := controller.readRawBody(writer, request)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Application.Container.Resources.Logger, err)
		return
	}
	request.Header.Set(integrations.GooglePlayPushTokenHeader, readPushToken(request.Header))
	if err := controller.Application.Gateway.HandleSignedStoreRefundNotification(request.Context(), request.PathValue("store"), body, request.Header); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Application.Container.Resources.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]bool{"received": true})
}

func readPushToken(headers http.Header) string {
	if token := strings.TrimSpace(headers.Get(integrations.GooglePlayPushTokenHeader)); token != "" {
		return token
	}
	if bearer, found := strings.CutPrefix(headers.Get("Authorization"), "Bearer "); found {
		return strings.TrimSpace(bearer)
	}
	return ""
}
