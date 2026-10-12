package controllers

import (
	"net/http"

	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/subscriptions/src/modules/billing/dtos"
	"zudomart/modules/subscriptions/src/modules/billing/services"
	"zudomart/platform/httpserver"
)

func (controller BillingController) offerChargingCountry(request *http.Request, userId string) string {
	if userId != "" {
		if country := controller.resolveChargingCountry(request, userId); country != "" {
			return country
		}
	}
	return controller.resolveViewerRegion(request, userId).CountryCode
}

func (controller BillingController) PreviewOffer(writer http.ResponseWriter, request *http.Request) {
	userId := ledgerutils.ReadOptionalPrincipalUserId(request, controller.Billing.Container.Resources.AccessVerifier)
	profileId := request.URL.Query().Get("profileId")
	if len(profileId) > 80 {
		profileId = ""
	}
	preview, err := controller.Billing.PreviewOffer(request.Context(), services.OfferPreviewRequest{
		Token: request.PathValue("token"), UserId: userId, ProfileId: profileId, ChargingCountry: controller.offerChargingCountry(request, userId),
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	writer.Header().Set("Cache-Control", "private, no-store")
	httpserver.WriteJsonResponse(writer, http.StatusOK, preview)
}

func (controller BillingController) ClaimOffer(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.ClaimOfferRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("profileId", body.ProfileId, 0, 80)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	claim, err := controller.Billing.ClaimOffer(request.Context(), services.OfferClaimRequest{
		Token: request.PathValue("token"), UserId: principal.UserId, ProfileId: body.ProfileId, ChargingCountry: controller.offerChargingCountry(request, principal.UserId),
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, claim)
}
