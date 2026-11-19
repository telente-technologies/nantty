package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/middlewares"
	"nantty/modules/orders/src/modules/partnerLogistics/services"
	"nantty/modules/orders/src/modules/partnerLogistics/store"
	"nantty/platform/httpserver"
)

type PartnerLogisticsController struct {
	Container *container.Container
}

func (controller PartnerLogisticsController) service() services.Service {
	return services.Service{
		Container: controller.Container,
		Store:     store.PartnerLogisticsStore{Database: controller.Container.Database},
	}
}

func (controller PartnerLogisticsController) Quote(writer http.ResponseWriter, request *http.Request) {
	var body services.QuoteInput
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	access := middlewares.StoreAccessFrom(request.Context())
	quote, err := controller.service().Quote(request.Context(), access.StoreId, body)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, quote)
}

func (controller PartnerLogisticsController) Book(writer http.ResponseWriter, request *http.Request) {
	httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusServiceUnavailable, "PARTNER_BOOKING_UNAVAILABLE", "Partner delivery booking is not available yet."))
}

func (controller PartnerLogisticsController) Cancel(writer http.ResponseWriter, request *http.Request) {
	var body services.CancelInput
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	access := middlewares.StoreAccessFrom(request.Context())
	if err := controller.service().Cancel(request.Context(), access.StoreId, body); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

func (controller PartnerLogisticsController) Track(writer http.ResponseWriter, request *http.Request) {
	shipmentId, err := uuid.Parse(request.PathValue("shipmentId"))
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_SHIPMENT_ID", "Invalid shipmentId."))
		return
	}
	access := middlewares.StoreAccessFrom(request.Context())
	shipment, events, found, err := store.PartnerLogisticsStore{Database: controller.Container.Database}.FindShipmentAndEvents(request.Context(), access.StoreId, shipmentId)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	if !found {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "SHIPMENT_NOT_FOUND", "Shipment not found."))
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"shipment": shipment, "events": events})
}

func (controller PartnerLogisticsController) KwikpikWebhook(writer http.ResponseWriter, request *http.Request) {
	if err := controller.service().HandleWebhook(request.Context(), request); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"received": true})
}
