package services

import (
	"context"
	"errors"
	"testing"

	"zudomart/modules/ledger/src/loaders"
	"zudomart/modules/payments/src/configs"
	"zudomart/modules/payments/src/constants"
	"zudomart/modules/payments/src/container"
	"zudomart/platform/httpserver"
)

func TestPaymentAmountsAreCappedPerPaymentType(t *testing.T) {
	gateway := &PaymentGateway{Container: &container.Container{Settings: configs.PaymentsSettings{
		PaymentMinimums: map[string]int64{"NGN": 100}, PaymentLimits: loaders.DefaultPaymentLimits(),
	}}}
	ctx := context.Background()
	cases := []struct {
		name    string
		purpose string
		amount  int64
		allowed bool
	}{
		{"below the minimum", constants.PurposeCoinPurchase, 99, false},
		{"coins at ₦500,000", constants.PurposeCoinPurchase, 50_000_000, true},
		{"coins above ₦500,000", constants.PurposeCoinPurchase, 50_000_001, false},
		{"ads top-up at ₦10m", constants.PurposeAdBalanceTopUp, 1_000_000_000, true},
		{"ads top-up above ₦10m", constants.PurposeAdBalanceTopUp, 1_000_000_001, false},
		{"creator subscription keeps its tier cap only", constants.PurposeCreatorSubscription, 2_000_000_000, true},
	}
	for _, check := range cases {
		err := gateway.RequirePaymentAmountWithinLimits(ctx, check.purpose, "NGN", check.amount)
		if check.allowed != (err == nil) || (err != nil && !errors.Is(err, ErrPaymentAmountOutOfRange)) {
			t.Errorf("%s: allowed=%v err=%v", check.name, check.allowed, err)
		}
	}
	if err := gateway.RequireOrderAmountWithinLimit(ctx, "NGN", 500_000_000); err != nil {
		t.Fatalf("a ₦5m order is allowed: %v", err)
	}
	err := gateway.RequireOrderAmountWithinLimit(ctx, "NGN", 500_000_001)
	var apiError *httpserver.ApiError
	if !errors.As(err, &apiError) || apiError.Code != "PAYMENT_AMOUNT_OUT_OF_RANGE" || apiError.Details["reason"] != ContactSupportForLargeOrders {
		t.Fatalf("a larger order asks the buyer to contact support: %v", err)
	}
	if err := gateway.RequirePaymentAmountWithinLimits(ctx, constants.PurposeCoinPurchase, "GHS", 50_000_000); err == nil {
		t.Fatal("other currencies get the converted cap, not the naira number")
	}
}
