package payments_test

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/payments/src/generated/ent/paymentrefund"
	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
)

func startBillingRefundHarness(t *testing.T) (*paymentstesting.MoneyHarness, *paymentservices.PaymentGateway) {
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	harness.Flutterwave.SeedSuccessfulCharge("sub-charge-1", 1_500_000, "NGN")
	return harness, harness.Payments.Application.Gateway
}

func assertLedgerHealthy(t *testing.T, harness *paymentstesting.MoneyHarness) {
	t.Helper()
	report, err := harness.Ledger.VerifyTrialBalanceAndCachedBalances(context.Background(), harness.Database)
	if err != nil || !report.Healthy() {
		t.Fatalf("ledger must stay balanced: %+v err=%v", report, err)
	}
}

func runTwoConsumersAtOnce(call func() error) []error {
	var group sync.WaitGroup
	start := make(chan struct{})
	results := make([]error, 2)
	for index := range results {
		group.Add(1)
		go func() {
			defer group.Done()
			<-start
			results[index] = call()
		}()
	}
	close(start)
	group.Wait()
	return results
}

func TestRedeliveredCheckmarkShareRefundCallsTheProviderExactlyOnce(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness, gateway := startBillingRefundHarness(t)
	harness.Flutterwave.RefundDelay = 300 * time.Millisecond
	request := paymentservices.PartialBillingRefund{BillingReference: "sub-charge-1", Reference: "verification-share:case-race", AmountMinor: 450_000, Currency: "NGN", Reason: "Checkmark verification rejected"}
	ctx := context.Background()

	results := runTwoConsumersAtOnce(func() error {
		_, err := gateway.RefundBillingSubscriptionPartially(ctx, request)
		return err
	})
	succeeded := 0
	for _, err := range results {
		switch {
		case err == nil:
			succeeded++
		case !errors.Is(err, paymentservices.ErrRefundInFlight):
			t.Fatalf("a concurrent redelivery waits for the first consumer: %v", err)
		}
	}
	if succeeded == 0 {
		t.Fatalf("one consumer must send the refund: %v", results)
	}
	if _, err := gateway.RefundBillingSubscriptionPartially(ctx, request); err != nil {
		t.Fatalf("a later redelivery replays the stored outcome: %v", err)
	}
	if calls := harness.Flutterwave.CallCounts["POST /transactions"]; calls != 1 || len(harness.Flutterwave.Refunds) != 1 {
		t.Fatalf("exactly one provider refund: calls=%d refunds=%v", calls, harness.Flutterwave.Refunds)
	}
	if note, _ := harness.Flutterwave.Refunds[0]["comment"].(string); !strings.Contains(note, "[ref:verification-share:case-race]") {
		t.Fatalf("the deterministic reference travels with the refund: %q", note)
	}
	balance, err := harness.Ledger.ReadAccountBalance(ctx, harness.Database, ledgermodels.RefundsPayableAccount("flutterwave", "NGN"))
	if err != nil || balance != 450_000 {
		t.Fatalf("one ledger entry for the share: balance=%d err=%v", balance, err)
	}
	assertLedgerHealthy(t, harness)
}

func TestFullVerificationRefundIsSentOnceUnderConcurrentRedelivery(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness, gateway := startBillingRefundHarness(t)
	harness.Flutterwave.RefundDelay = 300 * time.Millisecond
	results := runTwoConsumersAtOnce(func() error {
		_, err := gateway.RefundBillingSubscriptionCharge(context.Background(), "sub-charge-1", "verification-refund:case-full", "Checkmark verification rejected")
		return err
	})
	for _, err := range results {
		if err != nil && !errors.Is(err, paymentservices.ErrRefundInFlight) {
			t.Fatalf("unexpected error: %v", err)
		}
	}
	if _, err := gateway.RefundBillingSubscriptionCharge(context.Background(), "sub-charge-1", "verification-refund:case-full", "again"); err != nil {
		t.Fatalf("replay: %v", err)
	}
	if calls := harness.Flutterwave.CallCounts["POST /transactions"]; calls != 1 {
		t.Fatalf("the full refund is sent once: %d", calls)
	}
}

func TestRefundWithLostProviderReplyIsLookedUpInsteadOfResent(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness, gateway := startBillingRefundHarness(t)
	request := paymentservices.PartialBillingRefund{BillingReference: "sub-charge-1", Reference: "verification-share:case-lost", AmountMinor: 450_000, Currency: "NGN", Reason: "Checkmark verification rejected"}
	ctx := context.Background()
	harness.Flutterwave.LoseNextRefundReply = true
	if _, err := gateway.RefundBillingSubscriptionPartially(ctx, request); err == nil {
		t.Fatal("a lost reply must surface so the refund is retried")
	}
	result, err := gateway.RefundBillingSubscriptionPartially(ctx, request)
	if err != nil || result.ProviderRefundId == "" {
		t.Fatalf("the retry finds the refund the provider already made: %+v err=%v", result, err)
	}
	if calls := harness.Flutterwave.CallCounts["POST /transactions"]; calls != 1 || harness.Flutterwave.CallCounts["GET /refunds"] != 1 {
		t.Fatalf("looked up, not resent: %v", harness.Flutterwave.CallCounts)
	}
	assertLedgerHealthy(t, harness)
}

func TestCardCheckRefundWithLostReplyIsNotSentTwice(t *testing.T) {
	skipIntegrationWhenShort(t)
	previous := paymentservices.CardVerificationRefundRetryDelays
	paymentservices.CardVerificationRefundRetryDelays = []time.Duration{50 * time.Millisecond, 50 * time.Millisecond}
	t.Cleanup(func() { paymentservices.CardVerificationRefundRetryDelays = previous })
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	token := harness.Tokens.UserAccessToken(uuid.NewString())
	started := harness.Call(http.MethodPost, "/api/v1/payments/saved-cards/setups", token, "", map[string]any{"returnTo": "https://nantty.test/pay/return"})
	if started.Status != http.StatusCreated {
		t.Fatalf("setup: %d %s", started.Status, started.Raw)
	}
	reference := started.Body["reference"].(string)
	harness.Flutterwave.CompleteCheckout(reference, 0, 0, "card")
	harness.Flutterwave.LoseNextRefundReply = true
	if completed := harness.Call(http.MethodPost, "/api/v1/payments/saved-cards/setups/"+reference+"/complete", token, "", map[string]any{}); completed.Status != http.StatusOK {
		t.Fatalf("complete: %d %s", completed.Status, completed.Raw)
	}
	client := harness.Payments.Application.Gateway.Container.Client(harness.Database)
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if found, _ := client.PaymentRefund.Query().Where(paymentrefund.ProviderRefundIDNEQ("")).Exist(context.Background()); found {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	time.Sleep(200 * time.Millisecond)
	refund, err := client.PaymentRefund.Query().Only(context.Background())
	if err != nil || refund.ProviderRefundID == "" || refund.AttemptCount < 2 {
		t.Fatalf("the retry must adopt the refund the provider already made: %+v err=%v", refund, err)
	}
	if calls := harness.Flutterwave.CallCounts["POST /transactions"]; calls != 1 {
		t.Fatalf("the card check is refunded once: %d calls", calls)
	}
}

func TestRefundAmountsAtOrBelowZeroAreRefusedNotTreatedAsFull(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness, gateway := startBillingRefundHarness(t)
	ctx := context.Background()
	for _, amount := range []int64{0, -1} {
		if _, err := gateway.RefundSubscriptionPayment(ctx, paymentservices.SubscriptionPaymentRefund{PaymentReference: "ren-x", Reference: "r-" + uuid.NewString(), AmountMinor: amount}); !errors.Is(err, paymentservices.ErrRefundAmountInvalid) {
			t.Fatalf("amount %d: %v", amount, err)
		}
		if _, err := gateway.RefundBillingSubscriptionPartially(ctx, paymentservices.PartialBillingRefund{BillingReference: "sub-charge-1", Reference: "s-" + uuid.NewString(), AmountMinor: amount, Currency: "NGN"}); err == nil {
			t.Fatalf("partial amount %d accepted", amount)
		}
	}
	if _, err := gateway.RefundSubscriptionPayment(ctx, paymentservices.SubscriptionPaymentRefund{PaymentReference: "ren-x", Reference: "r-both", AmountMinor: 5, Full: true}); !errors.Is(err, paymentservices.ErrRefundAmountInvalid) {
		t.Fatalf("an amount together with full is ambiguous: %v", err)
	}
	if harness.Flutterwave.CallCounts["POST /transactions"] != 0 {
		t.Fatal("no provider call for an invalid amount")
	}
}
