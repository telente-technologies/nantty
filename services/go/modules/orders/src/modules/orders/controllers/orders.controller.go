package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/middlewares"
	cancelmyorder "nantty/modules/orders/src/modules/orders/commands/cancelMyOrder"
	checkoutcart "nantty/modules/orders/src/modules/orders/commands/checkoutCart"
	confirmorderreceipt "nantty/modules/orders/src/modules/orders/commands/confirmOrderReceipt"
	"nantty/modules/orders/src/modules/orders/dtos"
	getmyorder "nantty/modules/orders/src/modules/orders/queries/getMyOrder"
	listmyorders "nantty/modules/orders/src/modules/orders/queries/listMyOrders"
	"nantty/modules/orders/src/modules/orders/validators"
	"nantty/modules/orders/src/services"
	"nantty/modules/orders/src/utils"
	"nantty/platform/httpserver"
)

type OrdersController struct {
	Container *container.Container
}

func (controller OrdersController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func (controller OrdersController) Checkout(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.CheckoutRequest](writer, request, validators.ValidateCheckout)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	useCredit := body.UseStoreCredit == nil || *body.UseStoreCredit
	promoCodes := map[uuid.UUID]string{}
	for _, promo := range body.PromoCodes {
		promoCodes[uuid.MustParse(promo.StoreId)] = promo.Code
	}
	paymentModes := map[uuid.UUID]string{}
	for _, choice := range body.PaymentModes {
		paymentModes[uuid.MustParse(choice.StoreId)] = choice.Mode
	}
	result, err := (checkoutcart.Handler{Container: controller.Container}).Execute(request.Context(), checkoutcart.Command{Request: services.CheckoutRequest{
		BuyerId: middlewares.AccountIdFrom(request.Context()), AddressId: uuid.MustParse(body.AddressId), ShippingQuoteRevision: body.ShippingQuoteRevision, IdempotencyKey: request.Header.Get("Idempotency-Key"), UseStoreCredit: useCredit, PromoCodes: promoCodes, PaymentModes: paymentModes, DirectPaymentAccepted: body.DirectPaymentAccepted,
	}})
	controller.respond(writer, request, http.StatusCreated, result, err)
}

func (controller OrdersController) ListOrders(writer http.ResponseWriter, request *http.Request) {
	limit, err := utils.ReadPageLimit(request, 20, 50)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	query := request.URL.Query()
	page, err := (listmyorders.Handler{Container: controller.Container}).Execute(request.Context(), listmyorders.Query{
		BuyerId: middlewares.AccountIdFrom(request.Context()), Status: query.Get("status"), Cursor: query.Get("cursor"), Limit: limit,
	})
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller OrdersController) GetOrder(writer http.ResponseWriter, request *http.Request) {
	orderId, err := utils.PathIdentifier(request, "orderId")
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (getmyorder.Handler{Container: controller.Container}).Execute(request.Context(), getmyorder.Query{BuyerId: middlewares.AccountIdFrom(request.Context()), OrderId: orderId})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller OrdersController) CancelOrder(writer http.ResponseWriter, request *http.Request) {
	orderId, err := utils.PathIdentifier(request, "orderId")
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	body := dtos.CancelOrderRequest{Reason: "Cancelled by buyer"}
	if request.ContentLength > 0 {
		if body, err = utils.DecodeAndValidate[dtos.CancelOrderRequest](writer, request, validators.ValidateCancel); err != nil {
			controller.respond(writer, request, 0, nil, err)
			return
		}
	}
	view, err := (cancelmyorder.Handler{Container: controller.Container}).Execute(request.Context(),
		cancelmyorder.Command{BuyerId: middlewares.AccountIdFrom(request.Context()), OrderId: orderId, Reason: body.Reason})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller OrdersController) ConfirmReceipt(writer http.ResponseWriter, request *http.Request) {
	orderId, err := utils.PathIdentifier(request, "orderId")
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (confirmorderreceipt.Handler{Container: controller.Container}).Execute(request.Context(),
		confirmorderreceipt.Command{BuyerId: middlewares.AccountIdFrom(request.Context()), OrderId: orderId})
	controller.respond(writer, request, http.StatusOK, view, err)
}
