package controllers

import (
	"net/http"
	"strings"

	"nantty/modules/creators/src/modules/creatorProgram/dtos"
	"nantty/modules/creators/src/modules/creatorProgram/services"
	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/staffaudit"
	"nantty/platform/staffauth"
)

var errAuditUnavailable = httpserver.NewApiError(http.StatusServiceUnavailable, "AUDIT_UNAVAILABLE", "The audit log is unavailable; try again shortly.")

type CreatorProgramController struct {
	Program services.CreatorProgram
}

func (controller CreatorProgramController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Program.Container.Resources.Logger, err)
}

func (controller CreatorProgramController) ListCreatorTiers(writer http.ResponseWriter, request *http.Request) {
	tiers, err := controller.Program.ListCreatorTiers(request.Context())
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(tiers, ""))
}

func (controller CreatorProgramController) UpdateCreatorTier(writer http.ResponseWriter, request *http.Request) {
	staff, _ := staffauth.StaffFromContext(request.Context())
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.UpdateCreatorTierRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireRange("giftShareBps", body.GiftShareBps, 0, 7000)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	tier, err := controller.Program.UpdateCreatorTierShare(request.Context(), staff.Id, request.PathValue("tierId"), body.GiftShareBps)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, tier)
}

func (controller CreatorProgramController) audit(writer http.ResponseWriter, request *http.Request, action, subjectId, reason string, before, after any) bool {
	container := controller.Program.Container
	if container.Audit == nil {
		if container.Settings.Money.IsProduction() {
			controller.fail(writer, request, errAuditUnavailable)
			return false
		}
		return true
	}
	staff, _ := staffauth.StaffFromContext(request.Context())
	if err := staffaudit.RecordStaffChange(request, container.Audit, staff, action, "creator", subjectId, reason, before, after); err != nil {
		controller.fail(writer, request, errAuditUnavailable)
		return false
	}
	return true
}

func (controller CreatorProgramController) SetCreatorMembership(writer http.ResponseWriter, request *http.Request) {
	staff, _ := staffauth.StaffFromContext(request.Context())
	userId := request.PathValue("userId")
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.SetCreatorMembershipRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireUuid("userId", userId)
		collector.RequireLength("tierId", body.TierId, 1, 40)
		collector.RequireOneOf("status", body.Status, "approved", "suspended")
		collector.RequireLength("reason", body.Reason, 0, 500)
		if body.Status == "suspended" {
			collector.RequireLength("reason", strings.TrimSpace(body.Reason), 3, 500)
		}
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	before, err := controller.Program.FindMembership(request.Context(), userId)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	if !controller.audit(writer, request, "creators.membership.update", userId, body.Reason, before, body) {
		return
	}
	membership, err := controller.Program.SetCreatorProgramMembership(request.Context(), services.MembershipChange{
		StaffId: staff.Id, UserId: userId, TierId: body.TierId, Status: body.Status, Reason: strings.TrimSpace(body.Reason),
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, membership)
}

func (controller CreatorProgramController) ListViolations(writer http.ResponseWriter, request *http.Request) {
	violations, err := controller.Program.ListViolations(request.Context(), request.PathValue("userId"))
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(violations, ""))
}

func (controller CreatorProgramController) RecordViolation(writer http.ResponseWriter, request *http.Request) {
	staff, _ := staffauth.StaffFromContext(request.Context())
	userId := request.PathValue("userId")
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.RecordViolationRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireUuid("userId", userId)
		collector.RequireLength("reason", strings.TrimSpace(body.Reason), 3, 500)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	if !controller.audit(writer, request, "creators.violation.record", userId, body.Reason, nil, body) {
		return
	}
	violation, err := controller.Program.RecordViolation(request.Context(), staff.Id, userId, strings.TrimSpace(body.Reason), "staff")
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, violation)
}
