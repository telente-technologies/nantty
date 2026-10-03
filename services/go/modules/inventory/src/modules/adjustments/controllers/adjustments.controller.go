package controllers

import (
	"net/http"

	"zudomart/modules/inventory/src/container"
	"zudomart/modules/inventory/src/middlewares"
	applystockadjustments "zudomart/modules/inventory/src/modules/adjustments/commands/applyStockAdjustments"
	"zudomart/modules/inventory/src/modules/adjustments/dtos"
	liststockadjustments "zudomart/modules/inventory/src/modules/adjustments/queries/listStockAdjustments"
	"zudomart/modules/inventory/src/modules/adjustments/validators"
	"zudomart/modules/inventory/src/utils"
	"zudomart/platform/httpserver"
)

type AdjustmentsController struct {
	Container *container.Container
}

func (controller AdjustmentsController) responder() utils.Responder {
	return utils.Responder{Logger: controller.Container.Logger}
}

func (controller AdjustmentsController) ListAdjustments(writer http.ResponseWriter, request *http.Request) {
	store := middlewares.StoreAccessFrom(request.Context())
	location, err := utils.OptionalQueryIdentifier(request, "locationId")
	limit, limitError := utils.ReadPageLimit(request, 25, 200)
	if err == nil {
		err = limitError
	}
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	query := request.URL.Query()
	page, err := (liststockadjustments.Handler{Container: controller.Container}).Execute(request.Context(), liststockadjustments.Query{
		StoreId: store.StoreId, LocationId: location, Reason: query.Get("reason"), Text: query.Get("q"), Cursor: query.Get("cursor"), Limit: limit,
	})
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, page)
}

func (controller AdjustmentsController) CreateAdjustments(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.AdjustmentRequest](writer, request, validators.ValidateAdjustment)
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	page, err := (applystockadjustments.Handler{Container: controller.Container}).Execute(request.Context(), applystockadjustments.Command{
		Store: middlewares.StoreAccessFrom(request.Context()), ActorAccountId: middlewares.AccountIdFrom(request.Context()),
		IdempotencyKey: request.Header.Get("Idempotency-Key"), Request: body,
	})
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, page)
}
