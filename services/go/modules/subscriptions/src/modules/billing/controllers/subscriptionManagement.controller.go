package controllers

import (
	"net/http"

	"github.com/google/uuid"

	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/modules/subscriptions/src/modules/billing/dtos"
	"nantty/modules/subscriptions/src/modules/billing/services"
	"nantty/platform/httpserver"
)

func (controller BillingController) ownerAndSubscription(writer http.ResponseWriter, request *http.Request) (string, uuid.UUID, bool) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return "", uuid.Nil, false
	}
	id, err := uuid.Parse(request.PathValue("subscriptionId"))
	if err != nil {
		controller.fail(writer, request, services.ErrSubscriptionMissing)
		return "", uuid.Nil, false
	}
	return principal.UserId, id, true
}

func (controller BillingController) ChangePlan(writer http.ResponseWriter, request *http.Request) {
	userId, id, ok := controller.ownerAndSubscription(writer, request)
	if !ok {
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.ChangePlanRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("planCode", body.PlanCode+body.PlanId, 1, 60)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	planCode, interval := body.PlanCode, body.Interval
	if body.PlanId != "" {
		planCode, interval = splitPlanId(body.PlanId)
	}
	if interval == "" {
		interval = "month"
	}
	if interval != "month" && interval != "year" {
		controller.fail(writer, request, services.ErrPlanNotFound)
		return
	}
	view, err := controller.Billing.ChangePlan(request.Context(), userId, id, planCode, interval)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}

func (controller BillingController) PayNow(writer http.ResponseWriter, request *http.Request) {
	userId, id, ok := controller.ownerAndSubscription(writer, request)
	if !ok {
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.PayNowRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("returnTo", body.ReturnTo, 0, 300)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := controller.Billing.PayOutstandingPeriod(request.Context(), userId, id, body.ReturnTo)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, view)
}

func (controller BillingController) ListPeriods(writer http.ResponseWriter, request *http.Request) {
	userId, id, ok := controller.ownerAndSubscription(writer, request)
	if !ok {
		return
	}
	periods, err := controller.Billing.ListPeriods(request.Context(), userId, id)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"data": periods, "nextCursor": nil})
}

func (controller BillingController) UpcomingCharge(writer http.ResponseWriter, request *http.Request) {
	userId, id, ok := controller.ownerAndSubscription(writer, request)
	if !ok {
		return
	}
	view, err := controller.Billing.PreviewUpcomingCharge(request.Context(), userId, id)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}
