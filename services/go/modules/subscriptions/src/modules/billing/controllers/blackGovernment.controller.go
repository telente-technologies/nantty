package controllers

import (
	"net/http"
	"strconv"

	"github.com/google/uuid"

	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/modules/subscriptions/src/modules/billing/services"
	"nantty/platform/httpserver"
	"nantty/platform/staffauth"
)

type blackCheckoutDto struct {
	ProfileId        string `json:"profileId"`
	Interval         string `json:"interval"`
	OfferClaimId     string `json:"offerClaimId"`
	TermsAccepted    bool   `json:"termsAccepted"`
	RecurringConsent bool   `json:"recurringConsent"`
	ReturnTo         string `json:"returnTo"`
	ClientPlatform   string `json:"clientPlatform"`
}

type blackProfileActionDto struct {
	ProfileId string `json:"profileId"`
	ReturnTo  string `json:"returnTo"`
}

type blackAdminReasonDto struct {
	Reason string `json:"reason"`
}

func (controller BillingController) GetGovernmentBlackBilling(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := controller.Billing.GetGovernmentBlackBilling(request.Context(), principal.UserId, request.URL.Query().Get("profileId"))
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}

func (controller BillingController) StartGovernmentBlackCheckout(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body blackCheckoutDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("returnTo", body.ReturnTo, 0, 300)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := controller.Billing.StartGovernmentBlackCheckout(request.Context(), principal.UserId, services.BlackCheckoutRequest{
		ProfileId: body.ProfileId, Interval: body.Interval, OfferClaimId: body.OfferClaimId,
		TermsAccepted: body.TermsAccepted, RecurringConsent: body.RecurringConsent,
		ReturnTo: body.ReturnTo, ClientPlatform: body.ClientPlatform,
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, view)
}

func (controller BillingController) StartGovernmentBlackCardReplacement(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body blackProfileActionDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("returnTo", body.ReturnTo, 0, 300)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := controller.Billing.StartGovernmentBlackCardReplacement(request.Context(), principal.UserId, body.ProfileId, body.ReturnTo)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, view)
}

func (controller BillingController) ReactivateGovernmentBlack(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(_ blackProfileActionDto) error { return nil })
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := controller.Billing.ReactivateGovernmentBlackSubscription(request.Context(), principal.UserId, body.ProfileId)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}

func (controller BillingController) CancelGovernmentBlack(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(_ blackProfileActionDto) error { return nil })
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := controller.Billing.CancelGovernmentBlackSubscription(request.Context(), principal.UserId, body.ProfileId)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}

func (controller BillingController) AdminListGovernmentBlack(writer http.ResponseWriter, request *http.Request) {
	limit := 50
	if raw := request.URL.Query().Get("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 || parsed > 100 {
			controller.fail(writer, request, httpserver.NewApiError(http.StatusBadRequest, "INVALID_LIMIT", "Limit must be between 1 and 100."))
			return
		}
		limit = parsed
	}
	page, err := controller.Billing.AdminListGovernmentBlack(request.Context(), limit, request.URL.Query().Get("cursor"))
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, page)
}

func (controller BillingController) AdminPauseGovernmentBlack(writer http.ResponseWriter, request *http.Request) {
	staff, _ := staffauth.StaffFromContext(request.Context())
	id, err := uuid.Parse(request.PathValue("subscriptionId"))
	if err != nil {
		controller.fail(writer, request, services.ErrSubscriptionMissing)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body blackAdminReasonDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("reason", body.Reason, 4, 300)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := controller.Billing.AdminPauseGovernmentBlack(request.Context(), staff.Id, id, body.Reason)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}

func (controller BillingController) AdminCancelGovernmentBlack(writer http.ResponseWriter, request *http.Request) {
	staff, _ := staffauth.StaffFromContext(request.Context())
	id, err := uuid.Parse(request.PathValue("subscriptionId"))
	if err != nil {
		controller.fail(writer, request, services.ErrSubscriptionMissing)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body blackAdminReasonDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("reason", body.Reason, 4, 300)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := controller.Billing.AdminCancelGovernmentBlack(request.Context(), staff.Id, id, body.Reason)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}

func (controller BillingController) AdminRetryGovernmentBlack(writer http.ResponseWriter, request *http.Request) {
	staff, _ := staffauth.StaffFromContext(request.Context())
	id, err := uuid.Parse(request.PathValue("subscriptionId"))
	if err != nil {
		controller.fail(writer, request, services.ErrSubscriptionMissing)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body blackAdminReasonDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("reason", body.Reason, 4, 300)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := controller.Billing.AdminRetryGovernmentBlack(request.Context(), staff.Id, id, body.Reason)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}

func (controller BillingController) AdminReconcileGovernmentBlack(writer http.ResponseWriter, request *http.Request) {
	staff, _ := staffauth.StaffFromContext(request.Context())
	id, err := uuid.Parse(request.PathValue("subscriptionId"))
	if err != nil {
		controller.fail(writer, request, services.ErrSubscriptionMissing)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body blackAdminReasonDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("reason", body.Reason, 4, 300)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := controller.Billing.AdminReconcileGovernmentBlack(request.Context(), staff.Id, id, body.Reason)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}
