package controllers

import (
	"net/http"

	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/platform/httpserver"
)

func (controller BillingController) ListVerificationPlans(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	plans, err := controller.Billing.ListVerificationPlans(request.Context(), principal.UserId, controller.resolveViewerRegion(request, principal.UserId))
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(plans, ""))
}

func (controller BillingController) CancelVerificationSubscription(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	if _, err := ledgerutils.ReadRequiredIdempotencyKey(request); err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := controller.Billing.CancelVerificationSubscription(request.Context(), principal.UserId)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}
