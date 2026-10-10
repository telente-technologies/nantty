package controllers

import (
	"net/http"
	"strings"

	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/subscriptions/src/modules/creatorSubscriptions/dtos"
	"zudomart/modules/subscriptions/src/modules/creatorSubscriptions/services"
	"zudomart/platform/httpserver"
)

const maximumStoreReceiptBytes = 64 << 10

func platformOf(request *http.Request, fromBody string) string {
	if fromBody != "" {
		return strings.ToLower(fromBody)
	}
	return strings.ToLower(request.Header.Get("X-Client-Platform"))
}

func (controller CreatorSubscriptionsController) StartStorePurchase(writer http.ResponseWriter, request *http.Request) {
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
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.StartStorePurchaseRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireUuid("planId", body.PlanId)
		collector.RequireOneOf("platform", platformOf(request, body.Platform), "ios", "android")
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, replayed, err := controller.Service.StartStorePurchase(request.Context(), services.StartStorePurchase{
		SubscriberId: principal.UserId, CreatorId: request.PathValue("creatorId"), PlanId: body.PlanId, Channel: platformOf(request, body.Platform), IdempotencyKey: key,
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	ledgerutils.WriteIdempotentJsonResponse(writer, http.StatusCreated, view, replayed)
}

func (controller CreatorSubscriptionsController) RedeemStoreReceipt(writer http.ResponseWriter, request *http.Request) {
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
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.StoreReceiptRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireOneOf("platform", platformOf(request, body.Platform), "ios", "android")
		collector.RequireLength("productId", body.ProductId, 1, 120)
		collector.RequireLength("receipt", body.Receipt, 1, maximumStoreReceiptBytes)
		collector.RequireLength("transactionId", body.TransactionId, 0, 200)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, replayed, err := controller.Service.RedeemStoreReceipt(request.Context(), services.StoreReceiptRedemption{
		SubscriberId: principal.UserId, Channel: platformOf(request, body.Platform), ProductId: body.ProductId, Receipt: body.Receipt,
		TransactionId: body.TransactionId, IdempotencyKey: key,
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	ledgerutils.WriteIdempotentJsonResponse(writer, http.StatusOK, view, replayed)
}

func (controller CreatorSubscriptionsController) PriceTiers(writer http.ResponseWriter, request *http.Request) {
	interval := request.URL.Query().Get("interval")
	if interval == "" {
		interval = "month"
	}
	if interval != "month" && interval != "year" {
		controller.fail(writer, request, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "interval", Message: "is not an allowed value"}}))
		return
	}
	tiers, err := controller.Service.PriceTiers(request.Context(), request.URL.Query().Get("currency"), interval)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(tiers, ""))
}
