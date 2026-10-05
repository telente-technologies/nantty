package controllers

import (
	"net/http"
	"strings"

	"github.com/google/uuid"

	closedispute "zudomart/modules/escrow/src/modules/disputes/commands/closeDispute"
	opendispute "zudomart/modules/escrow/src/modules/disputes/commands/openDispute"
	postdisputemessage "zudomart/modules/escrow/src/modules/disputes/commands/postDisputeMessage"
	resolvedispute "zudomart/modules/escrow/src/modules/disputes/commands/resolveDispute"
	"zudomart/modules/escrow/src/modules/disputes/dtos"
	getdispute "zudomart/modules/escrow/src/modules/disputes/queries/getDispute"
	listdisputes "zudomart/modules/escrow/src/modules/disputes/queries/listDisputes"
	"zudomart/modules/escrow/src/modules/disputes/services"
	"zudomart/modules/escrow/src/modules/disputes/validators"
	"zudomart/modules/escrow/src/modules/escrows"
	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/platform/httpserver"
	"zudomart/platform/staffauth"
)

type DisputesController struct {
	Application *escrows.Application
}

func (controller DisputesController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Application.Container.Resources.Logger, err)
}

func readCursor(request *http.Request) (*uuid.UUID, error) {
	raw := request.URL.Query().Get("cursor")
	if raw == "" {
		return nil, nil
	}
	parsed, err := uuid.Parse(raw)
	if err != nil {
		return nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "cursor", Message: "is invalid"}})
	}
	return &parsed, nil
}

func (controller DisputesController) OpenDispute(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	key, err := ledgerutils.ReadRequiredIdempotencyKey(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, validators.ValidateOpenDisputeRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, replayed, err := opendispute.Handler{Application: controller.Application}.Execute(request.Context(), opendispute.Command{IdempotencyKey: key, Input: services.OpenDisputeInput{
		BuyerUserId: principal.UserId, OrderId: request.PathValue("orderId"), Reason: body.Reason, Description: strings.TrimSpace(body.Description), EvidenceUrls: body.EvidenceUrls,
	}})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	ledgerutils.WriteIdempotentJsonResponse(writer, http.StatusCreated, view, replayed)
}

func (controller DisputesController) PostDisputeMessage(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	disputeId, err := uuid.Parse(request.PathValue("disputeId"))
	if err != nil {
		controller.fail(writer, request, httpserver.ErrNotFound)
		return
	}
	controller.postMessage(writer, request, principal.UserId, disputeId, false)
}

func (controller DisputesController) PostSupportDisputeMessage(writer http.ResponseWriter, request *http.Request) {
	staffMember, _ := staffauth.StaffFromContext(request.Context())
	disputeId, err := uuid.Parse(request.PathValue("disputeId"))
	if err != nil {
		controller.fail(writer, request, httpserver.ErrNotFound)
		return
	}
	controller.postMessage(writer, request, staffMember.Id, disputeId, true)
}

func (controller DisputesController) postMessage(writer http.ResponseWriter, request *http.Request, authorId string, disputeId uuid.UUID, asSupport bool) {
	key, err := ledgerutils.ReadRequiredIdempotencyKey(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, validators.ValidateDisputeMessageRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	message, replayed, err := postdisputemessage.Handler{Application: controller.Application}.Execute(request.Context(), postdisputemessage.Command{IdempotencyKey: key, Input: services.DisputeMessageInput{
		DisputeId: disputeId, AuthorUserId: authorId, AsSupport: asSupport, Text: strings.TrimSpace(body.Text), AttachmentUrls: body.AttachmentUrls,
	}})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	ledgerutils.WriteIdempotentJsonResponse(writer, http.StatusCreated, message, replayed)
}

func (controller DisputesController) CloseDispute(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	disputeId, parseError := uuid.Parse(request.PathValue("disputeId"))
	if err != nil || parseError != nil {
		controller.fail(writer, request, httpserver.ErrNotFound)
		return
	}
	view, err := closedispute.Handler{Application: controller.Application}.Execute(request.Context(), closedispute.Command{BuyerUserId: principal.UserId, DisputeId: disputeId})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}

func (controller DisputesController) ResolveDispute(writer http.ResponseWriter, request *http.Request) {
	staffMember, _ := staffauth.StaffFromContext(request.Context())
	disputeId, err := uuid.Parse(request.PathValue("disputeId"))
	if err != nil {
		controller.fail(writer, request, httpserver.ErrNotFound)
		return
	}
	key, err := ledgerutils.ReadRequiredIdempotencyKey(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	var decision validators.ResolveDisputeDecision
	if _, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.ResolveDisputeRequestDto) error {
		normalized, err := validators.NormalizeResolveDisputeRequest(body)
		decision = normalized
		return err
	}); err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, replayed, err := resolvedispute.Handler{Application: controller.Application}.Execute(request.Context(), resolvedispute.Command{IdempotencyKey: key, Input: services.ResolveDisputeInput{
		DisputeId: disputeId, StaffId: staffMember.Id, Outcome: decision.Outcome, RefundMinor: decision.RefundMinor, RefundCurrency: decision.RefundCurrency, Note: decision.Note,
	}})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	ledgerutils.WriteIdempotentJsonResponse(writer, http.StatusOK, view, replayed)
}

func viewerFromRequest(request *http.Request) (string, bool, error) {
	if staff, found := staffauth.StaffFromContext(request.Context()); found {
		return staff.Id, true, nil
	}
	principal, err := ledgerutils.RequirePrincipal(request)
	return principal.UserId, false, err
}

func (controller DisputesController) GetDispute(writer http.ResponseWriter, request *http.Request) {
	viewerId, asStaff, err := viewerFromRequest(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	disputeId, err := uuid.Parse(request.PathValue("disputeId"))
	if err != nil {
		controller.fail(writer, request, httpserver.ErrNotFound)
		return
	}
	view, err := getdispute.Handler{Application: controller.Application}.Execute(request.Context(), getdispute.Query{DisputeId: disputeId, ViewerUserId: viewerId, AsStaff: asStaff})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}

func (controller DisputesController) ListDisputes(writer http.ResponseWriter, request *http.Request) {
	viewerId, asStaff, err := viewerFromRequest(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	query := listdisputes.Query{Limit: ledgerutils.ReadPageLimit(request), Status: request.URL.Query().Get("status"), ViewerUserId: viewerId, AsStaff: asStaff}
	if query.Status != "" {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireOneOf("status", query.Status, "awaiting_seller", "under_review", "resolved_refunded", "resolved_released", "closed")
		if err := collector.Result(); err != nil {
			controller.fail(writer, request, err)
			return
		}
	}
	cursor, err := readCursor(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	query.AfterId = cursor
	page, err := listdisputes.Handler{Application: controller.Application}.Execute(request.Context(), query)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, page)
}
