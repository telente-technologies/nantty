package controllers

import (
	"context"
	"crypto/subtle"
	"net/http"
	"strings"

	"github.com/google/uuid"

	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/subscriptions/src/constants"
	"zudomart/modules/subscriptions/src/modules/billing/dtos"
	"zudomart/modules/subscriptions/src/modules/billing/services"
	"zudomart/platform/httpserver"
)

type BillingController struct {
	Billing       services.Billing
	CreatorAccess func(ctx context.Context, subscriberId, creatorId string) (bool, error)
}

func (controller BillingController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Billing.Container.Resources.Logger, err)
}

func splitPlanId(planId string) (string, string) {
	for _, suffix := range []string{"_monthly", "_yearly"} {
		if code, found := strings.CutSuffix(planId, suffix); found {
			return code, map[string]string{"_monthly": "month", "_yearly": "year"}[suffix]
		}
	}
	return planId, "month"
}

func (controller BillingController) StartCheckout(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.CheckoutRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("profileId", body.ProfileId, 0, 80)
		collector.RequireLength("returnTo", body.ReturnTo, 0, 300)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	if body.ProfileId == "" {
		if body.ProfileId, err = controller.sellerProfileId(request, principal.UserId); err != nil || body.ProfileId == "" {
			controller.fail(writer, request, services.ErrProfileNotFound)
			return
		}
	}
	planCode, interval := body.PlanCode, body.Interval
	if body.PlanId != "" {
		planCode, interval = splitPlanId(body.PlanId)
	}
	if interval == "" {
		interval = "month"
	}
	if _, known := constants.Plans[planCode]; !known || (interval != "month" && interval != "year") {
		controller.fail(writer, request, services.ErrPlanNotFound)
		return
	}
	if strings.HasSuffix(request.URL.Path, "/trial/checkout") {
		body.WithTrial = true
	}
	view, err := controller.Billing.StartCheckout(request.Context(), services.CheckoutRequest{
		UserId: principal.UserId, ProfileId: body.ProfileId, PlanCode: planCode, Interval: interval, WithTrial: body.WithTrial, ReturnTo: body.ReturnTo,
		ClientPlatform: strings.ToLower(request.Header.Get("X-Client-Platform")), DeviceId: request.Header.Get("X-Device-Id"),
		ViewerCountry: controller.resolveChargingCountry(request, principal.UserId),
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, view)
}

func (controller BillingController) Cancel(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	id, err := uuid.Parse(request.PathValue("subscriptionId"))
	if err != nil {
		controller.fail(writer, request, services.ErrSubscriptionMissing)
		return
	}
	view, err := controller.Billing.CancelSubscription(request.Context(), principal.UserId, id)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}

func (controller BillingController) ListMine(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	views, err := controller.Billing.ListMySubscriptions(request.Context(), principal.UserId)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"data": views, "nextCursor": nil})
}

func (controller BillingController) Offer(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	profileId := request.URL.Query().Get("profileId")
	if profileId == "" {
		if profileId, err = controller.sellerProfileId(request, principal.UserId); err != nil {
			controller.fail(writer, request, err)
			return
		}
	}
	offer, err := controller.Billing.BuildOffer(request.Context(), principal.UserId, profileId)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, offer)
}

func (controller BillingController) RedeemStoreReceipt(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.StoreReceiptRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireOneOf("platform", body.Platform, "ios", "android")
		collector.RequireLength("profileId", body.ProfileId, 0, 80)
		collector.RequireLength("productId", body.ProductId, 1, 200)
		collector.RequireLength("receipt", body.Receipt, 0, 20_000)
		collector.RequireLength("transactionId", body.TransactionId, 0, 200)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := controller.Billing.RedeemStoreSubscription(request.Context(), services.StoreReceiptRequest{
		UserId: principal.UserId, Platform: body.Platform, ProfileId: body.ProfileId, ProductId: body.ProductId, Receipt: body.Receipt, TransactionId: body.TransactionId,
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}

func (controller BillingController) InternalEntitlements(writer http.ResponseWriter, request *http.Request) {
	expected := controller.Billing.Container.Settings.InternalApiToken
	if len(expected) < 32 || subtle.ConstantTimeCompare([]byte(expected), []byte(request.Header.Get("X-Internal-Token"))) != 1 {
		httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
		return
	}
	entitlements, err := controller.Billing.ReadEntitlements(request.Context(), request.PathValue("userId"))
	if creatorId := request.URL.Query().Get("creatorId"); err == nil && creatorId != "" && controller.CreatorAccess != nil {
		entitlements.SubscribedToCreator, err = controller.CreatorAccess(request.Context(), entitlements.UserId, creatorId)
	}
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	writer.Header().Set("Cache-Control", "private, max-age=60")
	httpserver.WriteJsonResponse(writer, http.StatusOK, entitlements)
}
