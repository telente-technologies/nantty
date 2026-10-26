package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/middlewares"
	addcartitem "nantty/modules/orders/src/modules/cart/commands/addCartItem"
	changecartitemquantity "nantty/modules/orders/src/modules/cart/commands/changeCartItemQuantity"
	clearcart "nantty/modules/orders/src/modules/cart/commands/clearCart"
	removecartitem "nantty/modules/orders/src/modules/cart/commands/removeCartItem"
	"nantty/modules/orders/src/modules/cart/dtos"
	getcart "nantty/modules/orders/src/modules/cart/queries/getCart"
	"nantty/modules/orders/src/modules/cart/validators"
	"nantty/modules/orders/src/utils"
	"nantty/platform/httpserver"
)

type CartController struct {
	Container *container.Container
}

func (controller CartController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func (controller CartController) GetCart(writer http.ResponseWriter, request *http.Request) {
	view, err := (getcart.Handler{Container: controller.Container}).Execute(request.Context(), getcart.Query{AccountId: middlewares.AccountIdFrom(request.Context())})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller CartController) GetShippingQuote(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.ShippingQuoteRequest](writer, request, validators.ValidateShippingQuote)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	addressId := uuid.MustParse(body.AddressId)
	view, err := (getcart.Handler{Container: controller.Container}).Execute(request.Context(), getcart.Query{AccountId: middlewares.AccountIdFrom(request.Context()), AddressId: &addressId})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller CartController) AddItem(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.AddCartItemRequest](writer, request, validators.ValidateAddCartItem)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (addcartitem.Handler{Container: controller.Container}).Execute(request.Context(), addcartitem.Command{AccountId: middlewares.AccountIdFrom(request.Context()), Request: body})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller CartController) ChangeQuantity(writer http.ResponseWriter, request *http.Request) {
	itemId, err := utils.PathIdentifier(request, "itemId")
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	body, err := utils.DecodeAndValidate[dtos.ChangeQuantityRequest](writer, request, validators.ValidateChangeQuantity)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (changecartitemquantity.Handler{Container: controller.Container}).Execute(request.Context(),
		changecartitemquantity.Command{AccountId: middlewares.AccountIdFrom(request.Context()), ItemId: itemId, Quantity: body.Quantity})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller CartController) RemoveItem(writer http.ResponseWriter, request *http.Request) {
	itemId, err := utils.PathIdentifier(request, "itemId")
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (removecartitem.Handler{Container: controller.Container}).Execute(request.Context(),
		removecartitem.Command{AccountId: middlewares.AccountIdFrom(request.Context()), ItemId: itemId})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller CartController) ClearCart(writer http.ResponseWriter, request *http.Request) {
	view, err := (clearcart.Handler{Container: controller.Container}).Execute(request.Context(), clearcart.Command{AccountId: middlewares.AccountIdFrom(request.Context())})
	controller.respond(writer, request, http.StatusOK, view, err)
}
