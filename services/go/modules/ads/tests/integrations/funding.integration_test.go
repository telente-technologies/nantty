package integrations_test

import (
	"context"
	"testing"

	"nantty/modules/ads/src/integrations"
)

func TestInMemoryFundingIsIdempotentAndRefundsReleaseTheCharge(t *testing.T) {
	gateway := integrations.NewInMemoryFundingGateway()
	ctx := context.Background()
	_ = gateway.ChargeUserWalletForBoost(ctx, "u1", "NGN", 1000, "key-0001")
	_ = gateway.ChargeUserWalletForBoost(ctx, "u1", "NGN", 9999, "key-0001")
	if amount, found := gateway.ChargedAmount("u1", "key-0001"); !found || amount != 1000 {
		t.Fatalf("a replayed key keeps the first amount, got %d %v", amount, found)
	}
	_ = gateway.RefundBoostCharge(ctx, "u1", "NGN", 1000, "refund-key-0001", "key-0001")
	if _, found := gateway.ChargedAmount("u1", "key-0001"); found {
		t.Fatal("a refund must release the charge")
	}
}

func TestUnconfiguredFundingRefusesToMoveMoney(t *testing.T) {
	gateway := integrations.UnconfiguredFundingGateway{}
	if gateway.ChargeUserWalletForBoost(context.Background(), "u", "NGN", 1, "k") == nil || gateway.RefundBoostCharge(context.Background(), "u", "NGN", 1, "r", "k") == nil {
		t.Fatal("must refuse")
	}
}
