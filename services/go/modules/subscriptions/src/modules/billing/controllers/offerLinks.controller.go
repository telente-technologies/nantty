package controllers

import (
	"net/http"

	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/subscriptions/src/models"
	"zudomart/modules/subscriptions/src/modules/billing/dtos"
	"zudomart/modules/subscriptions/src/modules/billing/services"
	"zudomart/platform/httpserver"
	"zudomart/platform/staffaudit"
	"zudomart/platform/staffauth"
)

const offerLinkListLimit = 200

func (controller BillingController) recordOfferLinkAudit(request *http.Request, action, subjectId, reason string, before, after any) error {
	staff, _ := staffauth.StaffFromContext(request.Context())
	audit := controller.Billing.Container.Audit
	if audit == nil {
		if controller.Billing.Container.Settings.Money.IsProduction() {
			return errAuditUnavailable
		}
		return nil
	}
	if err := staffaudit.RecordStaffChange(request, audit, staff, action, "subscription_offer_link", subjectId, reason, before, after); err != nil {
		return errAuditUnavailable
	}
	return nil
}

func (controller BillingController) ListOfferLinks(writer http.ResponseWriter, request *http.Request) {
	links, err := controller.Billing.ListOfferLinks(request.Context(), offerLinkListLimit)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"data": links, "nextCursor": nil})
}

func (controller BillingController) CreateOfferLink(writer http.ResponseWriter, request *http.Request) {
	staff, _ := staffauth.StaffFromContext(request.Context())
	now := controller.Billing.Container.Now().UTC()
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.CreateOfferLinkRequestDto) error { return validateCreateOfferLink(body, now) })
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	terms := models.OfferTerms{Kind: body.DiscountKind, PercentOff: body.PercentOff}
	if body.AmountOff != nil {
		terms.AmountOffMinor, terms.Currency = body.AmountOff.AmountMinor, body.AmountOff.Currency
	}
	if err := controller.recordOfferLinkAudit(request, "subscriptions.offer_link.create", "new", body.Reason, nil, body); err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := controller.Billing.CreateOfferLink(request.Context(), services.NewOfferLink{
		Label: body.Label, PlanCodes: body.PlanCodes, Terms: terms, SingleUse: body.SingleUse, MaxClaims: body.MaxClaims,
		DurationCycles: body.DurationCycles, ExpiresAt: body.ExpiresAt, StaffId: staff.Id,
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, view)
}

func (controller BillingController) RevokeOfferLink(writer http.ResponseWriter, request *http.Request) {
	staff, _ := staffauth.StaffFromContext(request.Context())
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.RevokeOfferLinkRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("reason", body.Reason, 0, maximumOfferReasonLength)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	before, err := controller.Billing.FindOfferLinkView(request.Context(), request.PathValue("linkId"))
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	if err := controller.recordOfferLinkAudit(request, "subscriptions.offer_link.revoke", before.Id, body.Reason, before.Status, services.OfferStatusRevoked); err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := controller.Billing.RevokeOfferLink(request.Context(), before.Id, staff.Id)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}

func (controller BillingController) SendOfferLink(writer http.ResponseWriter, request *http.Request) {
	staff, _ := staffauth.StaffFromContext(request.Context())
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, validateSendOfferLink)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	link, err := controller.Billing.FindOfferLinkView(request.Context(), request.PathValue("linkId"))
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	if link.Status != services.OfferStatusActive {
		controller.fail(writer, request, services.ErrOfferLinkNotActive)
		return
	}
	recipients := normalizedOfferRecipients(body.RecipientEmails)
	if err := controller.recordOfferLinkAudit(request, "subscriptions.offer_link.send", link.Id, body.Reason, nil, map[string]any{"recipientEmails": recipients, "note": body.Note}); err != nil {
		controller.fail(writer, request, err)
		return
	}
	sends, err := controller.Billing.SendOfferLink(request.Context(), link.Id, staff.Id, body.Note, recipients)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, map[string]any{"data": sends, "nextCursor": nil})
}
