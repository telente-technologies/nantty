package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/middlewares"
	decidereturn "zudomart/modules/orders/src/modules/returns/commands/decideReturn"
	receivereturn "zudomart/modules/orders/src/modules/returns/commands/receiveReturn"
	requestreturn "zudomart/modules/orders/src/modules/returns/commands/requestReturn"
	"zudomart/modules/orders/src/modules/returns/dtos"
	listsellerreturns "zudomart/modules/orders/src/modules/returns/queries/listSellerReturns"
	"zudomart/modules/orders/src/modules/returns/validators"
	"zudomart/modules/orders/src/services"
	"zudomart/modules/orders/src/utils"
	"zudomart/platform/httpserver"
)

type ReturnsController struct {
	Container *container.Container
}

func (controller ReturnsController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func (controller ReturnsController) seller(request *http.Request) services.SellerContext {
	accountId := middlewares.AccountIdFrom(request.Context())
	name := ""
	if profiles, err := controller.Container.Users.PersonalProfilesByAccount(request.Context(), []uuid.UUID{accountId}); err == nil {
		name = profiles[accountId].Name
	}
	return services.SellerContext{Store: middlewares.StoreAccessFrom(request.Context()), ActorId: accountId, Name: name}
}

func (controller ReturnsController) list(writer http.ResponseWriter, request *http.Request, query listsellerreturns.Query) {
	limit, err := utils.ReadPageLimit(request, 25, 100)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	query.Limit, query.Status, query.Cursor = limit, request.URL.Query().Get("status"), request.URL.Query().Get("cursor")
	page, err := (listsellerreturns.Handler{Container: controller.Container}).Execute(request.Context(), query)
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller ReturnsController) ListSeller(writer http.ResponseWriter, request *http.Request) {
	storeId := middlewares.StoreAccessFrom(request.Context()).StoreId
	controller.list(writer, request, listsellerreturns.Query{StoreId: &storeId})
}

func (controller ReturnsController) ListMine(writer http.ResponseWriter, request *http.Request) {
	buyerId := middlewares.AccountIdFrom(request.Context())
	controller.list(writer, request, listsellerreturns.Query{BuyerId: &buyerId})
}

func (controller ReturnsController) Request(writer http.ResponseWriter, request *http.Request) {
	orderId, err := utils.PathIdentifier(request, "orderId")
	var body dtos.RequestReturnRequest
	if err == nil {
		body, err = utils.DecodeAndValidate[dtos.RequestReturnRequest](writer, request, validators.ValidateRequestReturn)
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (requestreturn.Handler{Container: controller.Container}).Execute(request.Context(), requestreturn.Command{BuyerId: middlewares.AccountIdFrom(request.Context()), OrderId: orderId, Request: body})
	controller.respond(writer, request, http.StatusCreated, view, err)
}

func (controller ReturnsController) Approve(writer http.ResponseWriter, request *http.Request) {
	returnId, err := utils.PathIdentifier(request, "returnId")
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (decidereturn.Handler{Container: controller.Container}).Execute(request.Context(), decidereturn.Command{Seller: controller.seller(request), ReturnId: returnId, Approve: true})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller ReturnsController) Decline(writer http.ResponseWriter, request *http.Request) {
	returnId, err := utils.PathIdentifier(request, "returnId")
	var body dtos.DeclineRequest
	if err == nil {
		body, err = utils.DecodeAndValidate[dtos.DeclineRequest](writer, request, validators.ValidateDecline)
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (decidereturn.Handler{Container: controller.Container}).Execute(request.Context(), decidereturn.Command{Seller: controller.seller(request), ReturnId: returnId, Note: body.Note})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller ReturnsController) Receive(writer http.ResponseWriter, request *http.Request) {
	returnId, err := utils.PathIdentifier(request, "returnId")
	var body dtos.ReceiveRequest
	if err == nil {
		body, err = utils.DecodeAndValidate[dtos.ReceiveRequest](writer, request, validators.ValidateReceive)
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	command := receivereturn.Command{Seller: controller.seller(request), ReturnId: returnId}
	if body.Restock && body.LocationId != nil {
		location := uuid.MustParse(*body.LocationId)
		command.LocationId = &location
	}
	view, err := (receivereturn.Handler{Container: controller.Container}).Execute(request.Context(), command)
	controller.respond(writer, request, http.StatusOK, view, err)
}
