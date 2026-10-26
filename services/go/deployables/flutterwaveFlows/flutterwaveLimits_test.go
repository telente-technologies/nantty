package flutterwaveflows

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ledger/src/loaders"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
)

func TestWalletPaymentsStopAtTheTiersDailyLimitAndResetTheNextDay(t *testing.T) {
	harness := startFlowHarness(t)
	buyer, seller := harness.newUser("NG"), harness.newUser("NG")
	harness.verifyToLevelOne(buyer)
	harness.verifyToLevelOne(seller)
	harness.deposit(buyer, 900_000)
	harness.advance(73 * time.Hour)
	harness.runWorkers()
	settings := &harness.Payments.Application.Container.Settings
	settings.PaymentLimits = loaders.DefaultPaymentLimits()
	settings.PaymentLimits.Base.WalletDaily.Basic = 150_000
	first := harness.registerOrder(buyer, seller, 100_000, "NGN", "escrow")
	harness.initialize(buyer, &first)
	if paid := harness.payWithWallet(buyer, first, "daily-limit-pay-01"); paid.Status != http.StatusOK {
		t.Fatalf("a payment inside the daily limit: %d %s", paid.Status, paid.Raw)
	}
	second := harness.registerOrder(buyer, seller, 80_000, "NGN", "escrow")
	harness.initialize(buyer, &second)
	refused := harness.payWithWallet(buyer, second, "daily-limit-pay-02")
	details, _ := refused.Body["details"].(map[string]any)
	remaining, _ := details["remaining"].(map[string]any)
	if refused.Status != http.StatusUnprocessableEntity || refused.Body["code"] != "WALLET_DAILY_LIMIT" || details["tier"] != "basic" || remaining["amountMinor"] != float64(50_000) {
		t.Fatalf("the basic tier stops at the day's limit and says what is left: %d %s", refused.Status, refused.Raw)
	}
	harness.advance(24 * time.Hour)
	if paid := harness.payWithWallet(buyer, second, "daily-limit-pay-03"); paid.Status != http.StatusOK {
		t.Fatalf("the limit resets the next day: %d %s", paid.Status, paid.Raw)
	}
	harness.assertWalletMatchesProvider(buyer)
	harness.AssertLedgerHealthy()
}

func TestOrdersAboveFiveMillionNairaAreRefusedWithAContactSupportReason(t *testing.T) {
	harness := startFlowHarness(t)
	buyer, seller := harness.newUser("NG"), harness.newUser("NG")
	harness.verifyToLevelOne(seller)
	payables := harness.payablesFor(buyer, seller, 500_000_001, "NGN")
	payables[0].CheckoutId, payables[0].OrderId, payables[0].OrderReference = uuid.NewString(), uuid.NewString(), "ZM-LARGE"
	payables[0].PaymentMode = "escrow"
	err := harness.gateway.RegisterCheckoutPayables(context.Background(), payables)
	if !errors.Is(err, paymentservices.ErrPaymentAmountOutOfRange) {
		t.Fatalf("an order above ₦5,000,000 is refused: %v", err)
	}
	harness.registerOrder(buyer, seller, 500_000_000, "NGN", "escrow")
}
