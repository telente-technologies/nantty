package controllers

import (
	"net/http"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/middlewares"
	cancelstocktransfer "nantty/modules/inventory/src/modules/transfers/commands/cancelStockTransfer"
	createstocktransfer "nantty/modules/inventory/src/modules/transfers/commands/createStockTransfer"
	receivestocktransfer "nantty/modules/inventory/src/modules/transfers/commands/receiveStockTransfer"
	"nantty/modules/inventory/src/modules/transfers/dtos"
	liststocktransfers "nantty/modules/inventory/src/modules/transfers/queries/listStockTransfers"
	"nantty/modules/inventory/src/modules/transfers/validators"
	"nantty/modules/inventory/src/utils"
	"nantty/platform/httpserver"
)

type TransfersController struct {
	Container *container.Container
}

func (controller TransfersController) responder() utils.Responder {
	return utils.Responder{Logger: controller.Container.Logger}
}

func (controller TransfersController) ListTransfers(writer http.ResponseWriter, request *http.Request) {
	limit, err := utils.ReadPageLimit(request, 25, 200)
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	query := request.URL.Query()
	page, err := (liststocktransfers.Handler{Container: controller.Container}).Execute(request.Context(), liststocktransfers.Query{
		StoreId: middlewares.StoreAccessFrom(request.Context()).StoreId, Status: query.Get("status"), Cursor: query.Get("cursor"), Limit: limit,
	})
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller TransfersController) CreateTransfer(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.TransferRequest](writer, request, validators.ValidateTransfer)
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	view, err := (createstocktransfer.Handler{Container: controller.Container}).Execute(request.Context(), createstocktransfer.Command{
		Store: middlewares.StoreAccessFrom(request.Context()), ActorAccountId: middlewares.AccountIdFrom(request.Context()),
		IdempotencyKey: request.Header.Get("Idempotency-Key"), Request: body,
	})
	controller.respond(writer, request, http.StatusCreated, view, err)
}

func (controller TransfersController) ReceiveTransfer(writer http.ResponseWriter, request *http.Request) {
	transferId, err := utils.PathIdentifier(request, "transferId")
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	view, err := (receivestocktransfer.Handler{Container: controller.Container}).Execute(request.Context(), receivestocktransfer.Command{
		Store: middlewares.StoreAccessFrom(request.Context()), TransferId: transferId,
		ActorAccountId: middlewares.AccountIdFrom(request.Context()), IdempotencyKey: request.Header.Get("Idempotency-Key"),
	})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller TransfersController) CancelTransfer(writer http.ResponseWriter, request *http.Request) {
	transferId, err := utils.PathIdentifier(request, "transferId")
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	view, err := (cancelstocktransfer.Handler{Container: controller.Container}).Execute(request.Context(), cancelstocktransfer.Command{
		Store: middlewares.StoreAccessFrom(request.Context()), TransferId: transferId,
		ActorAccountId: middlewares.AccountIdFrom(request.Context()), IdempotencyKey: request.Header.Get("Idempotency-Key"),
	})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller TransfersController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}
