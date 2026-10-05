package controllers

import (
	"net/http"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	issueadminrefund "zudomart/modules/orders/src/modules/adminOrders/commands/issueAdminRefund"
	getadminorder "zudomart/modules/orders/src/modules/adminOrders/queries/getAdminOrder"
	listadminorders "zudomart/modules/orders/src/modules/adminOrders/queries/listAdminOrders"
	listadminrefunds "zudomart/modules/orders/src/modules/adminOrders/queries/listAdminRefunds"
	"zudomart/modules/orders/src/modules/adminOrders/services"
	"zudomart/modules/orders/src/modules/adminOrders/validators"
	"zudomart/modules/orders/src/utils"
	"zudomart/platform/httpserver"
	"zudomart/platform/idempotency"
	"zudomart/platform/staffauth"
)

var errIdempotencyKeyRequired = httpserver.NewApiError(http.StatusBadRequest, "IDEMPOTENCY_KEY_REQUIRED", "Send an Idempotency-Key header of 8-128 letters, digits, - or _.")

type AdminOrdersController struct {
	Container *container.Container
}

func (controller AdminOrdersController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func (controller AdminOrdersController) ListOrders(writer http.ResponseWriter, request *http.Request) {
	limit, err := utils.ReadPageLimit(request, 25, 100)
	if err == nil {
		err = validators.ValidateOrderFilters(request)
	}
	var storeId *uuid.UUID
	if err == nil {
		storeId, err = utils.OptionalQueryIdentifier(request, "storeId")
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	values := request.URL.Query()
	page, err := listadminorders.Handler{Container: controller.Container}.Execute(request.Context(), listadminorders.Query{
		Status: values.Get("status"), Currency: values.Get("currency"), StoreId: storeId, Text: values.Get("search"), Cursor: values.Get("cursor"), Limit: limit,
	})
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller AdminOrdersController) GetOrder(writer http.ResponseWriter, request *http.Request) {
	idOrNumber := strings.TrimSpace(request.PathValue("orderIdOrNumber"))
	if idOrNumber == "" || len(idOrNumber) > 64 {
		controller.respond(writer, request, 0, nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "orderIdOrNumber", Message: "must be an order id or number"}}))
		return
	}
	detail, err := getadminorder.Handler{Container: controller.Container}.Execute(request.Context(), getadminorder.Query{IdOrNumber: idOrNumber})
	controller.respond(writer, request, http.StatusOK, detail, err)
}

func (controller AdminOrdersController) ListRefunds(writer http.ResponseWriter, request *http.Request) {
	limit, err := utils.ReadPageLimit(request, 25, 100)
	if err == nil {
		err = validators.ValidateRefundFilters(request)
	}
	var orderId *uuid.UUID
	if err == nil {
		orderId, err = utils.OptionalQueryIdentifier(request, "orderId")
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	values := request.URL.Query()
	page, err := listadminrefunds.Handler{Container: controller.Container}.Execute(request.Context(), listadminrefunds.Query{
		Source: values.Get("source"), Status: values.Get("status"), OrderId: orderId, Text: values.Get("search"), Cursor: values.Get("cursor"), Limit: limit,
	})
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller AdminOrdersController) IssueRefund(writer http.ResponseWriter, request *http.Request) {
	key := request.Header.Get("Idempotency-Key")
	if !idempotency.IsValidIdempotencyKey(key) {
		controller.respond(writer, request, 0, nil, errIdempotencyKeyRequired)
		return
	}
	body, err := utils.DecodeAndValidate(writer, request, validators.ValidateIssueRefund)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	staff, _ := staffauth.StaffFromContext(request.Context())
	refund := services.AdminRefund{Staff: staff, OrderId: uuid.MustParse(body.OrderId), AmountMinor: body.Amount.AmountMinor, Currency: string(body.Amount.Currency),
		Reason: strings.TrimSpace(body.Reason), IdempotencyKey: key}
	record, replayed, err := issueadminrefund.Handler{Container: controller.Container}.Execute(request.Context(), issueadminrefund.Command{Refund: refund, Request: request})
	if err == nil && replayed {
		writer.Header().Set("Idempotent-Replayed", "true")
	}
	controller.respond(writer, request, http.StatusCreated, record, err)
}
