package services

import (
	"context"
	"testing"

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
