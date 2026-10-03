package controllers

import (
	"net/http"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/escrow/src/modules/escrows"
	refundescrowbystaff "zudomart/modules/escrow/src/modules/escrows/commands/refundEscrowByStaff"
	"zudomart/modules/escrow/src/modules/escrows/dtos"
	getescrowfororder "zudomart/modules/escrow/src/modules/escrows/queries/getEscrowForOrder"
	listsellerescrowholds "zudomart/modules/escrow/src/modules/escrows/queries/listSellerEscrowHolds"
	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/platform/httpserver"
	"zudomart/platform/staffauth"
)

type EscrowsController struct {
	Application *escrows.Application
}

func (controller EscrowsController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Application.Container.Resources.Logger, err)
}

func (controller EscrowsController) GetEscrowForOrder(writer http.ResponseWriter, request *http.Request) {
	query := getescrowfororder.Query{OrderId: request.PathValue("orderId")}
	if staff, found := staffauth.StaffFromContext(request.Context()); found {
		query.AsStaff, query.ViewerUserId = true, staff.Id
	} else {
		principal, err := ledgerutils.RequirePrincipal(request)
		if err != nil {
			controller.fail(writer, request, err)
			return
		}
		query.ViewerUserId = principal.UserId
	}
	detail, err := getescrowfororder.Handler{Application: controller.Application}.Execute(request.Context(), query)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, detail)
}

func (controller EscrowsController) ListMyEscrowHolds(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	query := listsellerescrowholds.Query{SellerUserId: principal.UserId, Limit: ledgerutils.ReadPageLimit(request)}
	if raw := request.URL.Query().Get("cursor"); raw != "" {
		parsed, err := uuid.Parse(raw)
		if err != nil {
			controller.fail(writer, request, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "cursor", Message: "is invalid"}}))
			return
		}
		query.AfterId = &parsed
	}
	page, err := listsellerescrowholds.Handler{Application: controller.Application}.Execute(request.Context(), query)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, page)
}

func (controller EscrowsController) RefundEscrowByStaff(writer http.ResponseWriter, request *http.Request) {
	staff, _ := staffauth.StaffFromContext(request.Context())
	key, err := ledgerutils.ReadRequiredIdempotencyKey(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.AdminRefundEscrowRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("reason", strings.TrimSpace(body.Reason), 3, 300)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	detail, replayed, err := refundescrowbystaff.Handler{Application: controller.Application}.Execute(request.Context(), refundescrowbystaff.Command{
		StaffId: staff.Id, OrderId: request.PathValue("orderId"), Reason: strings.TrimSpace(body.Reason), IdempotencyKey: key,
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	ledgerutils.WriteIdempotentJsonResponse(writer, http.StatusOK, detail, replayed)
}
