package controllers

import (
	"crypto/subtle"
	"net/http"
	"strings"

	"nantty/platform/httpserver"
)

func (controller AffiliatesController) CommissionRates(writer http.ResponseWriter, request *http.Request) {
	expected := controller.Affiliates.Container.Settings.InternalApiToken
	if len(expected) < 32 || subtle.ConstantTimeCompare([]byte(expected), []byte(request.Header.Get("X-Internal-Token"))) != 1 {
		httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
		return
	}
	storeId, productIds := request.URL.Query().Get("storeId"), []string{}
	for _, productId := range strings.Split(request.URL.Query().Get("productIds"), ",") {
		if productId = strings.TrimSpace(productId); productId != "" && len(productIds) < 200 {
			productIds = append(productIds, productId)
		}
	}
	if storeId == "" || len(productIds) == 0 {
		httpserver.WriteJsonResponse(writer, http.StatusBadRequest, httpserver.NewApiError(http.StatusBadRequest, "VALIDATION_FAILED", "storeId and productIds are required."))
		return
	}
	rates, err := controller.Affiliates.CommissionRates(request.Context(), storeId, productIds)
	controller.respond(writer, request, http.StatusOK, map[string]any{"storeId": storeId, "rates": rates}, err)
}
