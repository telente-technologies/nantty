package controllers

import (
	"net/http"
	"strings"

	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/modules/subscriptions/src/modules/billing/dtos"
	"nantty/modules/subscriptions/src/modules/billing/services"
	"nantty/platform/httpserver"
)

func validateCombinedGoldProfiles(collector *ledgerutils.IssueCollector, profileIds []string) {
	if len(profileIds) < 1 || len(profileIds) > 5 {
		collector.Add("profileIds", "choose between 1 and 5 business profiles")
	}
	for _, profileId := range profileIds {
		collector.RequireUuid("profileIds", profileId)
	}
}

func validateCombinedGoldOptions(collector *ledgerutils.IssueCollector, interval, offerClaimId string) {
	collector.RequireOneOf("interval", interval, "month", "year")
	if offerClaimId != "" {
		collector.RequireUuid("offerClaimId", offerClaimId)
	}
}

func (controller BillingController) combinedGoldRequest(request *http.Request, userId, interval, offerClaimId, returnTo string) services.CheckoutRequest {
	return services.CheckoutRequest{
		UserId: userId, Interval: interval, ReturnTo: returnTo, OfferClaimId: offerClaimId, ClientPlatform: strings.ToLower(request.Header.Get("X-Client-Platform")),
		ViewerCountry: controller.resolveChargingCountry(request, userId),
	}
}

func (controller BillingController) CombinedGoldOverview(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	overview, err := controller.Billing.ReadCombinedGoldOverview(request.Context(), principal.UserId)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, overview)
}

func (controller BillingController) QuoteCombinedGold(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.CombinedGoldQuoteRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		validateCombinedGoldProfiles(collector, body.ProfileIds)
		validateCombinedGoldOptions(collector, body.Interval, body.OfferClaimId)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	checkout := controller.combinedGoldRequest(request, principal.UserId, body.Interval, body.OfferClaimId, "")
	if personalCountry, _ := controller.Billing.Container.Identity.FindAccountCountry(request.Context(), principal.UserId); personalCountry != "" {
		checkout.ViewerCountry = personalCountry
	}
	quote, err := controller.Billing.QuoteCombinedGold(request.Context(), checkout, body.ProfileIds)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, quote)
}

func (controller BillingController) StartCombinedGoldCheckout(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.CombinedGoldCheckoutRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		validateCombinedGoldProfiles(collector, body.ProfileIds)
		validateCombinedGoldOptions(collector, body.Interval, body.OfferClaimId)
		collector.RequireLength("returnTo", body.ReturnTo, 0, 300)
		if body.ExpectedTotalMinor != nil {
			collector.RequireRange("expectedTotalMinor", *body.ExpectedTotalMinor, 0, 1_000_000_000_000)
		}
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := controller.Billing.StartCombinedGoldCheckout(request.Context(), services.CombinedGoldCheckoutRequest{
		Checkout: controller.combinedGoldRequest(request, principal.UserId, body.Interval, body.OfferClaimId, body.ReturnTo), ProfileIds: body.ProfileIds, ExpectedTotalMinor: body.ExpectedTotalMinor,
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, view)
}

func (controller BillingController) ChangeCombinedGoldProfiles(writer http.ResponseWriter, request *http.Request) {
	userId, id, ok := controller.ownerAndSubscription(writer, request)
	if !ok {
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.CombinedGoldProfilesRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		validateCombinedGoldProfiles(collector, body.ProfileIds)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := controller.Billing.ChangeCombinedGoldProfiles(request.Context(), userId, id, body.ProfileIds, body.ExpectedChargeMinor)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}
