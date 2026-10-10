package services

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"testing"

	"zudomart/modules/ledger/src/loaders"
	"zudomart/modules/payments/src/configs"
	"zudomart/modules/payments/src/container"
)

func TestEscrowFeeIsOnePointFivePercentOrOnePercentOnTheBusinessPlan(t *testing.T) {
	gateway := &PaymentGateway{Container: &container.Container{Settings: configs.PaymentsSettings{EscrowFeeBps: 150, BusinessEscrowFeeBps: 100}}}
	RegisterSellerPlanLookup(func(_ context.Context, sellerUserId string) string {
		if sellerUserId == "business-seller" {
			return "business"
		}
		return "pro"
	})
	defer RegisterSellerPlanLookup(nil)
	cases := []struct {
		seller string
		amount int64
		fee    int64
	}{
		{"pro-seller", 600_000, 9_000},
		{"business-seller", 600_000, 6_000},
		{"pro-seller", 1_000_001, 15_001},
		{"business-seller", 333, 4},
	}
	for _, testCase := range cases {
		if fee := EscrowFeeForAmount(testCase.amount, gateway.EscrowFeeBpsForSeller(context.Background(), testCase.seller)); fee != testCase.fee {
			t.Fatalf("%s %d: fee %d want %d", testCase.seller, testCase.amount, fee, testCase.fee)
		}
	}
}

func TestEscrowFeeFollowsTheAdminRevenueSetting(t *testing.T) {
	revenue := `{"escrowFee":{"defaultBasisPoints":150,"businessPlanBasisPoints":100}}`
	platform := loaders.NewPlatformSettingsSourceFromFetcher(func(context.Context, string) (json.RawMessage, error) {
		return json.RawMessage(revenue), nil
	}, 0, slog.New(slog.NewTextHandler(io.Discard, nil)))
	gateway := &PaymentGateway{Container: &container.Container{Resources: loaders.MoneyModuleResources{Platform: platform}, Settings: configs.PaymentsSettings{EscrowFeeBps: 150, BusinessEscrowFeeBps: 100}}}
	RegisterSellerPlanLookup(func(_ context.Context, sellerUserId string) string {
		if sellerUserId == "business-seller" {
			return "business"
		}
		return "pro"
	})
	defer RegisterSellerPlanLookup(nil)
	revenue = `{"escrowFee":{"defaultBasisPoints":200,"businessPlanBasisPoints":80}}`
	if fee := gateway.EscrowFeeBpsForSeller(context.Background(), "pro-seller"); fee != 200 {
		t.Fatalf("default escrow fee must follow the setting, got %d", fee)
	}
	if fee := gateway.EscrowFeeBpsForSeller(context.Background(), "business-seller"); fee != 80 {
		t.Fatalf("business escrow fee must follow the setting, got %d", fee)
	}
	revenue = `{"escrowFee":{}}`
	if fee := gateway.EscrowFeeBpsForSeller(context.Background(), "business-seller"); fee != 100 {
		t.Fatalf("a missing rate must use the environment value, got %d", fee)
	}
}
