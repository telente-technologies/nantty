package controllers

import (
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/middlewares"
	acceptorder "nantty/modules/orders/src/modules/sellerOrders/commands/acceptOrder"
	addordernote "nantty/modules/orders/src/modules/sellerOrders/commands/addOrderNote"
	cancelsellerorder "nantty/modules/orders/src/modules/sellerOrders/commands/cancelSellerOrder"
	recorddeliveryattempt "nantty/modules/orders/src/modules/sellerOrders/commands/recordDeliveryAttempt"
	refundsellerorder "nantty/modules/orders/src/modules/sellerOrders/commands/refundSellerOrder"
	rejectorder "nantty/modules/orders/src/modules/sellerOrders/commands/rejectOrder"
	shiporder "nantty/modules/orders/src/modules/sellerOrders/commands/shipOrder"
	updateorderstatus "nantty/modules/orders/src/modules/sellerOrders/commands/updateOrderStatus"
	updateshipment "nantty/modules/orders/src/modules/sellerOrders/commands/updateShipment"
	"nantty/modules/orders/src/modules/sellerOrders/dtos"
	getdeliverysummary "nantty/modules/orders/src/modules/sellerOrders/queries/getDeliverySummary"
	getsellerorder "nantty/modules/orders/src/modules/sellerOrders/queries/getSellerOrder"
	getshippingsnapshot "nantty/modules/orders/src/modules/sellerOrders/queries/getShippingSnapshot"
	listsellerorders "nantty/modules/orders/src/modules/sellerOrders/queries/listSellerOrders"
	listshipments "nantty/modules/orders/src/modules/sellerOrders/queries/listShipments"
	"nantty/modules/orders/src/modules/sellerOrders/validators"
	"nantty/modules/orders/src/services"
	"nantty/modules/orders/src/utils"
	"nantty/platform/commerceports"
	"nantty/platform/httpserver"
)

type SellerOrdersController struct {
	Container *container.Container
}

func (controller SellerOrdersController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func (controller SellerOrdersController) seller(request *http.Request) services.SellerContext {
	accountId := middlewares.AccountIdFrom(request.Context())
	name := ""
	if profiles, err := controller.Container.Users.PersonalProfilesByAccount(request.Context(), []uuid.UUID{accountId}); err == nil {
		name = profiles[accountId].Name
	}
	return services.SellerContext{Store: middlewares.StoreAccessFrom(request.Context()), ActorId: accountId, Name: name}
}

func (controller SellerOrdersController) store(request *http.Request) commerceports.StoreAccess {
	return middlewares.StoreAccessFrom(request.Context())
}

func parseDay(request *http.Request, name string) (*time.Time, error) {
	raw := request.URL.Query().Get(name)
	if raw == "" {
		return nil, nil
	}
	parsed, err := time.Parse("2006-01-02", raw)
	if err != nil {
		return nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: name, Message: "must be YYYY-MM-DD"}})
	}
	return &parsed, nil
}

func (controller SellerOrdersController) ListOrders(writer http.ResponseWriter, request *http.Request) {
	from, fromError := parseDay(request, "from")
	to, toError := parseDay(request, "to")
	limit, limitError := utils.ReadPageLimit(request, 25, 200)
	query := request.URL.Query()
	status := query.Get("status")
	var failure error
	for _, candidate := range []error{fromError, toError, limitError} {
		if failure == nil {
			failure = candidate
		}
	}
	if status != "" && status != "all" && !isSellerStatus(status) {
		failure = httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "status", Message: "unknown status"}})
	}
	if failure != nil {
		controller.respond(writer, request, 0, nil, failure)
		return
	}
	page, err := (listsellerorders.Handler{Container: controller.Container}).Execute(request.Context(), listsellerorders.Query{
		StoreId: controller.store(request).StoreId, Status: status, Text: query.Get("q"), From: from, To: to, Sort: query.Get("sort"),
		Descending: query.Get("direction") != "ascending", Cursor: query.Get("cursor"), Limit: limit,
	})
	controller.respond(writer, request, http.StatusOK, page, err)
}

func isSellerStatus(status string) bool {
	return strings.Contains(" new processing ready shipped delivered completed cancelled returned refunded disputed ", " "+status+" ")
}

func (controller SellerOrdersController) GetOrder(writer http.ResponseWriter, request *http.Request) {
	orderId, err := utils.PathIdentifier(request, "orderId")
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (getsellerorder.Handler{Container: controller.Container}).Execute(request.Context(), getsellerorder.Query{StoreId: controller.store(request).StoreId, OrderId: orderId})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller SellerOrdersController) GetShippingSnapshot(writer http.ResponseWriter, request *http.Request) {
	orderId, err := utils.PathIdentifier(request, "orderId")
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	snapshot, err := (getshippingsnapshot.Handler{Container: controller.Container}).Execute(request.Context(), getshippingsnapshot.Query{StoreId: controller.store(request).StoreId, OrderId: orderId})
	controller.respond(writer, request, http.StatusOK, snapshot, err)
}

func (controller SellerOrdersController) Accept(writer http.ResponseWriter, request *http.Request) {
	orderId, err := utils.PathIdentifier(request, "orderId")
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (acceptorder.Handler{Container: controller.Container}).Execute(request.Context(), acceptorder.Command{Seller: controller.seller(request), OrderId: orderId})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller SellerOrdersController) Reject(writer http.ResponseWriter, request *http.Request) {
	orderId, body, err := controller.orderAndReason(writer, request)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (rejectorder.Handler{Container: controller.Container}).Execute(request.Context(), rejectorder.Command{Seller: controller.seller(request), OrderId: orderId, Reason: body.Reason})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller SellerOrdersController) Cancel(writer http.ResponseWriter, request *http.Request) {
	orderId, body, err := controller.orderAndReason(writer, request)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (cancelsellerorder.Handler{Container: controller.Container}).Execute(request.Context(), cancelsellerorder.Command{Seller: controller.seller(request), OrderId: orderId, Reason: body.Reason})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller SellerOrdersController) Refund(writer http.ResponseWriter, request *http.Request) {
	orderId, err := utils.PathIdentifier(request, "orderId")
	var body dtos.RefundRequest
	if err == nil {
		body, err = utils.DecodeAndValidate[dtos.RefundRequest](writer, request, validators.ValidateRefund)
	}
	if err == nil && body.AmountMinor <= 0 {
		err = ordererrors.RefundAmountInvalid
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	command := refundsellerorder.Command{Seller: controller.seller(request), OrderId: orderId, AmountMinor: body.AmountMinor, Reason: strings.TrimSpace(body.Reason)}
	view, err := (refundsellerorder.Handler{Container: controller.Container}).Execute(request.Context(), command)
	controller.respond(writer, request, http.StatusCreated, view, err)
}

func (controller SellerOrdersController) orderAndReason(writer http.ResponseWriter, request *http.Request) (uuid.UUID, dtos.ReasonRequest, error) {
	orderId, err := utils.PathIdentifier(request, "orderId")
	if err != nil {
		return uuid.Nil, dtos.ReasonRequest{}, err
	}
	body, err := utils.DecodeAndValidate[dtos.ReasonRequest](writer, request, validators.ValidateReason)
	return orderId, body, err
}

func (controller SellerOrdersController) ChangeStatus(writer http.ResponseWriter, request *http.Request) {
	orderId, err := utils.PathIdentifier(request, "orderId")
	var body dtos.StatusRequest
	if err == nil {
		body, err = utils.DecodeAndValidate[dtos.StatusRequest](writer, request, validators.ValidateStatus)
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (updateorderstatus.Handler{Container: controller.Container}).Execute(request.Context(), updateorderstatus.Command{Seller: controller.seller(request), OrderId: orderId, Status: body.Status})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller SellerOrdersController) Ship(writer http.ResponseWriter, request *http.Request) {
	orderId, err := utils.PathIdentifier(request, "orderId")
	var body dtos.FulfilmentRequest
	if err == nil {
		body, err = utils.DecodeAndValidate[dtos.FulfilmentRequest](writer, request, validators.ValidateFulfilment)
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (shiporder.Handler{Container: controller.Container}).Execute(request.Context(), shiporder.Command{Seller: controller.seller(request), OrderId: orderId,
		Request: services.ShipRequest{Courier: body.Courier, TrackingNumber: body.TrackingNumber, TrackingUrl: body.TrackingUrl, FromLocationId: uuid.MustParse(body.FromLocationId)}})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller SellerOrdersController) AddNote(writer http.ResponseWriter, request *http.Request) {
	orderId, err := utils.PathIdentifier(request, "orderId")
	var body dtos.NoteRequest
	if err == nil {
		body, err = utils.DecodeAndValidate[dtos.NoteRequest](writer, request, validators.ValidateNote)
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (addordernote.Handler{Container: controller.Container}).Execute(request.Context(), addordernote.Command{Seller: controller.seller(request), OrderId: orderId, Body: body.Body})
	controller.respond(writer, request, http.StatusCreated, view, err)
}

func (controller SellerOrdersController) ListShipments(writer http.ResponseWriter, request *http.Request) {
	limit, err := utils.ReadPageLimit(request, 50, 200)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	query := request.URL.Query()
	page, err := (listshipments.Handler{Container: controller.Container}).Execute(request.Context(),
		listshipments.Query{StoreId: controller.store(request).StoreId, Status: query.Get("status"), Text: query.Get("q"), Cursor: query.Get("cursor"), Limit: limit})
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller SellerOrdersController) GetDeliverySummary(writer http.ResponseWriter, request *http.Request) {
	store := controller.store(request)
	summary, err := (getdeliverysummary.Handler{Container: controller.Container}).Execute(request.Context(), getdeliverysummary.Query{StoreId: store.StoreId, Currency: string(store.Currency)})
	controller.respond(writer, request, http.StatusOK, summary, err)
}

func (controller SellerOrdersController) PatchShipment(writer http.ResponseWriter, request *http.Request) {
	orderId, err := utils.PathIdentifier(request, "orderId")
	var body dtos.ShipmentPatchRequest
	if err == nil {
		body, err = utils.DecodeAndValidate[dtos.ShipmentPatchRequest](writer, request, validators.ValidateShipmentPatch)
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (updateshipment.Handler{Container: controller.Container}).Execute(request.Context(), updateshipment.Command{Seller: controller.seller(request), OrderId: orderId,
		Patch: services.ShipmentPatch{RiderName: body.RiderName, RiderPhone: body.RiderPhone, EstimatedDeliveryAt: body.EstimatedDeliveryAt, Retry: body.Retry}})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller SellerOrdersController) RecordAttempt(writer http.ResponseWriter, request *http.Request) {
	orderId, err := utils.PathIdentifier(request, "orderId")
	var body dtos.AttemptRequest
	if err == nil {
		body, err = utils.DecodeAndValidate[dtos.AttemptRequest](writer, request, validators.ValidateAttempt)
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (recorddeliveryattempt.Handler{Container: controller.Container}).Execute(request.Context(),
		recorddeliveryattempt.Command{Seller: controller.seller(request), OrderId: orderId, Outcome: body.Outcome, Note: body.Note})
	controller.respond(writer, request, http.StatusOK, view, err)
}
