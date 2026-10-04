package controllers

import (
	"net/http"
	"strconv"
	"time"

	"zudomart/modules/orders/src/container"
	liststorepurchasers "zudomart/modules/orders/src/modules/internalSources/queries/listStorePurchasers"
	"zudomart/modules/orders/src/utils"
	"zudomart/platform/httpserver"
)

type InternalSourcesController struct {
	Container *container.Container
}

func readBoundedInteger(request *http.Request, name string, fallback, minimum, maximum int, collected *utils.Issues) int {
	raw := request.URL.Query().Get(name)
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < minimum || value > maximum {
		collected.Add(name, "must be between "+strconv.Itoa(minimum)+" and "+strconv.Itoa(maximum))
	}
	return value
}

func (controller InternalSourcesController) ListStorePurchasers(writer http.ResponseWriter, request *http.Request) {
	responder := utils.Responder{Logger: controller.Container.Logger}
	storeId, err := utils.PathIdentifier(request, "storeId")
	if err != nil {
		responder.Error(writer, request, err)
		return
	}
	var collected utils.Issues
	retentionDays := readBoundedInteger(request, "retentionDays", 180, 1, 365, &collected)
	minimumOrders := readBoundedInteger(request, "minimumOrders", 1, 1, 100, &collected)
	limit := readBoundedInteger(request, "limit", 500, 1, 1000, &collected)
	if err := collected.AsError(); err != nil {
		responder.Error(writer, request, err)
		return
	}
	page, err := (liststorepurchasers.Handler{Container: controller.Container}).Execute(request.Context(), liststorepurchasers.Query{
		StoreId: storeId, PurchasedFrom: controller.Container.Now().Add(-time.Duration(retentionDays) * 24 * time.Hour), MinimumOrders: minimumOrders, Cursor: request.URL.Query().Get("cursor"), Limit: limit,
	})
	if err != nil {
		responder.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, page)
}
