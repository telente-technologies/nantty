package services

import (
	"context"
	"net/http"
	"strings"

	"zudomart/modules/ledger/src/loaders"
	"zudomart/modules/payments/src/constants"
	"zudomart/platform/httpserver"
)

var (
	ErrPaymentAmountOutOfRange = httpserver.NewApiError(http.StatusUnprocessableEntity, "PAYMENT_AMOUNT_OUT_OF_RANGE", "This amount is outside what can be paid in one payment.")
	ErrWalletDailyLimit        = httpserver.NewApiError(http.StatusUnprocessableEntity, "WALLET_DAILY_LIMIT", "This payment is more than your wallet can pay today.")
)

const ContactSupportForLargeOrders = "contactSupportForLargeOrders"

func (gateway *PaymentGateway) PaymentLimitsIn(ctx context.Context, currency string) loaders.PaymentLimitAmounts {
	platform := gateway.Container.Resources.Platform
	limits := platform.ReadPaymentLimits(ctx, gateway.Container.Settings.PaymentLimits)
	return limits.AmountsIn(strings.ToUpper(currency), platform.UsdRatesE8(ctx))
}

func (gateway *PaymentGateway) RequirePaymentAmountWithinLimits(ctx context.Context, purpose, currency string, amountMinor int64) error {
	currency = strings.ToUpper(currency)
	if minimum, set := gateway.Container.Settings.PaymentMinimums[currency]; set && amountMinor < minimum {
		return ErrPaymentAmountOutOfRange.WithDetails(map[string]any{"minimum": moneyDetail(minimum, currency)})
	}
	limits := gateway.PaymentLimitsIn(ctx, currency)
	maximum := map[string]int64{constants.PurposeCoinPurchase: limits.CoinPurchase, constants.PurposeAdBalanceTopUp: limits.AdsTopUp}[purpose]
	if maximum > 0 && amountMinor > maximum {
		return ErrPaymentAmountOutOfRange.WithDetails(map[string]any{"maximum": moneyDetail(maximum, currency)})
	}
	return nil
}

func (gateway *PaymentGateway) RequireOrderAmountWithinLimit(ctx context.Context, currency string, amountMinor int64) error {
	maximum := gateway.PaymentLimitsIn(ctx, currency).OrderCheckout
	if maximum > 0 && amountMinor > maximum {
		return ErrPaymentAmountOutOfRange.WithDetails(map[string]any{"reason": ContactSupportForLargeOrders, "maximum": moneyDetail(maximum, strings.ToUpper(currency))})
	}
	return nil
}

func moneyDetail(amountMinor int64, currency string) map[string]any {
	return map[string]any{"amountMinor": amountMinor, "currency": currency}
}
