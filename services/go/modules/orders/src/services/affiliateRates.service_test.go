package services

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/configs"
	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/platform/commerceports"
)

func TestCheckoutLocksTheAffiliateRateForAttributedLinesOnly(t *testing.T) {
	storeId, attributedProduct, plainProduct := uuid.New(), uuid.New(), uuid.New()
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Header.Get("X-Internal-Token") != "token" || request.URL.Query().Get("storeId") != storeId.String() || request.URL.Query().Get("productIds") != attributedProduct.String() {
			writer.WriteHeader(http.StatusBadRequest)
			return
		}
		_ = json.NewEncoder(writer).Encode(map[string]any{"rates": map[string]int64{attributedProduct.String(): 750}})
	}))
	defer server.Close()
	source, postId := "post", uuid.New()
	plan := CheckoutPlan{Groups: []PlannedGroup{{Group: SellerGroup{StoreId: storeId, Lines: []PricedCartLine{
		{Product: commerceports.ProductSnapshot{ProductId: attributedProduct}, AttributionSource: &source, AttributionId: &postId},
		{Product: commerceports.ProductSnapshot{ProductId: plainProduct}},
	}}}}}
	deployed := &container.Container{Settings: configs.OrdersSettings{MoneyInternalUrl: server.URL, MoneyInternalToken: "token"}, Logger: slog.New(slog.NewTextHandler(io.Discard, nil))}
	LockAffiliateCommissionRates(context.Background(), deployed, &plan)
	lines := plan.Groups[0].Group.Lines
	if lines[0].CommissionBps == nil || *lines[0].CommissionBps != 750 || lines[1].CommissionBps != nil {
		t.Fatalf("locked rates: %v %v", lines[0].CommissionBps, lines[1].CommissionBps)
	}
	deployed.Settings.MoneyInternalUrl = ""
	lines[0].CommissionBps = nil
	LockAffiliateCommissionRates(context.Background(), deployed, &plan)
	if lines[0].CommissionBps != nil {
		t.Fatal("an unreachable money service leaves the rate to be decided at release")
	}
}

func TestTheLockedRateTravelsWithTheAttributedItem(t *testing.T) {
	source, postId, rate := "clip", uuid.New(), int64(400)
	attributed := AttributedSaleItemsOf(&ent.OrderGroup{Currency: "NGN"}, []*ent.OrderItem{{ID: uuid.New(), Quantity: 1, LineTotalMinor: 5_000, AttributionSource: &source, AttributionID: &postId, AffiliateCommissionBps: &rate}})
	encoded, _ := json.Marshal(attributed[0])
	var decoded map[string]any
	_ = json.Unmarshal(encoded, &decoded)
	if decoded["commissionBasisPoints"] != float64(400) {
		t.Fatalf("event item: %s", encoded)
	}
}
