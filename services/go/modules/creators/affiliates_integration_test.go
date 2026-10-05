package creators

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"

	affiliateservices "zudomart/modules/creators/src/modules/affiliates/services"
	"zudomart/modules/creators/src/repositories"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
)

func TestAffiliateCommissionIsCreditedOncePerOrderAndProductOnRelease(t *testing.T) {
	creator, seller, buyer, other := uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()
	storeId, productId, excludedId := uuid.NewString(), uuid.NewString(), uuid.NewString()
	harness := startHttpHarness(t, repositories.StaticCreatorsDirectory{
		Owners: map[string]string{"post:p1": creator, "clip:c-self": buyer, "post:p-other": other},
		Stores: map[string]repositories.StoreSummary{storeId: {Id: storeId, Name: "Ada Fabrics", OwnerUserId: seller, Currency: "NGN", Active: true}},
		Products: map[string]repositories.ProductSummary{
			productId:  {Id: productId, StoreId: storeId, Name: "Ankara dress", PriceMinor: 2_000_000, Currency: "NGN", Published: true},
			excludedId: {Id: excludedId, StoreId: storeId, Name: "Gift card", PriceMinor: 500_000, Currency: "NGN", Published: true},
		},
		Users: map[string]repositories.UserSummary{creator: {Id: creator, Username: "ada"}},
	})
	harness.makeCreator(creator, "starter")
	harness.makeCreator(other, "starter")
	creatorToken, sellerToken := harness.tokens.UserAccessToken(creator), harness.tokens.UserAccessToken(seller)
	if status, body := harness.call(http.MethodPost, "/api/v1/creators/affiliations", creatorToken, "", map[string]any{"productId": productId}); status != http.StatusConflict || body["code"] != "AFFILIATE_PROGRAM_OFF" {
		t.Fatalf("closed program: %d %v", status, body)
	}
	if status, _ := harness.call(http.MethodPatch, "/api/v1/seller/affiliates/settings", sellerToken, "", map[string]any{"enabled": true, "defaultCommissionBasisPoints": 6000}); status != http.StatusBadRequest {
		t.Fatalf("commission is capped at 5000 bps: %d", status)
	}
	status, settings := harness.call(http.MethodPatch, "/api/v1/seller/affiliates/settings", sellerToken, "", map[string]any{"enabled": true, "defaultCommissionBasisPoints": 800, "autoApproveCreatorsWithFollowersAbove": nil})
	if status != http.StatusOK || settings["enabled"] != true || settings["defaultCommissionBasisPoints"] != float64(800) {
		t.Fatalf("settings: %d %v", status, settings)
	}
	harness.call(http.MethodPut, "/api/v1/seller/affiliates/product-commissions/"+excludedId, sellerToken, "", map[string]any{"commissionBasisPoints": nil, "excluded": true})
	_, requested := harness.call(http.MethodPost, "/api/v1/creators/affiliations", creatorToken, "", map[string]any{"storeId": storeId, "message": "I love your dresses"})
	if requested["status"] != "requested" {
		t.Fatalf("request: %v", requested)
	}
	_, requests := harness.call(http.MethodGet, "/api/v1/seller/affiliates/requests?status=pending", sellerToken, "", nil)
	requestId := requests["data"].([]any)[0].(map[string]any)["id"].(string)
	if status, decided := harness.call(http.MethodPost, "/api/v1/seller/affiliates/requests/"+requestId+"/approve", sellerToken, "", map[string]any{}); status != http.StatusOK || decided["status"] != "approved" {
		t.Fatalf("approve: %d %v", status, decided)
	}
	if status, _ := harness.call(http.MethodPost, "/api/v1/seller/affiliates/requests/"+requestId+"/decline", sellerToken, "", map[string]any{}); status != http.StatusConflict {
		t.Fatalf("a decided request stays decided: %d", status)
	}
	completed := affiliateservices.OrderGroupCompleted{OrderGroupId: uuid.NewString(), StoreId: storeId, SellerAccountId: seller, BuyerAccountId: buyer, Currency: "ngn",
		SubtotalMinor: 4_000_000, RefundedMinor: 400_000,
		AttributedItems: []affiliateservices.AttributedItem{
			{OrderItemId: "item-1", ProductId: productId, LineTotalMinor: 1_000_000, AttributionSource: "post", AttributionId: "p1"},
			{OrderItemId: "item-2", ProductId: productId, LineTotalMinor: 1_000_000, Currency: "NGN", AttributionSource: "post", AttributionId: "p1"},
			{OrderItemId: "item-usd", ProductId: productId, LineTotalMinor: 1_000_000, Currency: "USD", AttributionSource: "post", AttributionId: "p1"},
			{ProductId: excludedId, LineTotalMinor: 500_000, AttributionSource: "post", AttributionId: "p1"},
			{ProductId: uuid.NewString(), LineTotalMinor: 500_000, AttributionSource: "clip", AttributionId: "c-self"},
			{ProductId: uuid.NewString(), LineTotalMinor: 500_000, AttributionSource: "post", AttributionId: "p-other"},
			{ProductId: uuid.NewString(), LineTotalMinor: 500_000, AttributionSource: "story", AttributionId: "p1"},
		}}
	sale := completed.Sale()
	for range 2 {
		if _, err := harness.module.Affiliates.CreditCommissionsForRelease(context.Background(), sale); err != nil {
			t.Fatal(err)
		}
	}
	if payable := harness.balance(ledgermodels.CreatorEarningsPayableAccount(creator, "NGN")); payable != 144_000 {
		t.Fatalf("8%% of each attributed line after the 10%% refund, once per order item: %d", payable)
	}
	if payable := harness.balance(ledgermodels.CreatorEarningsPayableAccount(other, "NGN")); payable != 0 {
		t.Fatalf("creators outside the store's program earn nothing: %d", payable)
	}
	_, ledger := harness.call(http.MethodGet, "/api/v1/seller/affiliates/commission-ledger", sellerToken, "", nil)
	if entries := ledger["data"].([]any); len(entries) != 2 || entries[0].(map[string]any)["creatorUsername"] != "ada" || entries[0].(map[string]any)["status"] != "paid" {
		t.Fatalf("ledger: %v", ledger)
	}
	_, overview := harness.call(http.MethodGet, "/api/v1/seller/affiliates/overview", sellerToken, "", nil)
	if overview["activeCreatorsCount"] != float64(1) || overview["commissionsPaid"].(map[string]any)["amountMinor"] != float64(144_000) {
		t.Fatalf("overview: %v", overview)
	}
	_, mine := harness.call(http.MethodGet, "/api/v1/creators/affiliations", creatorToken, "", nil)
	affiliation := mine["data"].([]any)[0].(map[string]any)
	if affiliation["status"] != "active" || affiliation["salesCount"] != float64(2) || affiliation["earned"].(map[string]any)["amountMinor"] != float64(144_000) {
		t.Fatalf("my affiliations: %v", affiliation)
	}
	if status, _ := harness.call(http.MethodPatch, "/api/v1/seller/affiliates/creators/"+creator, sellerToken, "", map[string]any{"status": "paused"}); status != http.StatusOK {
		t.Fatalf("pause: %d", status)
	}
	completed.OrderGroupId = uuid.NewString()
	for index := range completed.AttributedItems {
		completed.AttributedItems[index].OrderItemId += "-again"
	}
	paused := completed.Sale()
	if credited, _ := harness.module.Affiliates.CreditCommissionsForRelease(context.Background(), paused); credited != 0 {
		t.Fatalf("paused creators stop earning: %d", credited)
	}
	if status, _ := harness.call(http.MethodGet, "/api/v1/seller/affiliates/settings", creatorToken, "", nil); status != http.StatusNotFound {
		t.Fatalf("only store owners manage the program: %d", status)
	}
	assertHealthy(t, harness.creatorsHarness)
}
