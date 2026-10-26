package payments

import (
	"context"
	"testing"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
)

func TestCheckmarkShareRefundPostsOneLedgerEntryAcrossRetries(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	harness.Flutterwave.SeedSuccessfulCharge("sub-charge-1", 1_500_000, "NGN")
	gateway := harness.Payments.Application.Gateway
	request := paymentservices.PartialBillingRefund{BillingReference: "sub-charge-1", Reference: "verification-share:case-1", AmountMinor: 450_000, Currency: "NGN", Reason: "Checkmark verification rejected"}
	ctx := context.Background()

	harness.Flutterwave.FailNextRequests = 3
	if _, err := gateway.RefundBillingSubscriptionPartially(ctx, request); err == nil {
		t.Fatal("a provider outage must surface so the refund is retried")
	}
	if _, err := gateway.RefundBillingSubscriptionPartially(ctx, request); err != nil {
		t.Fatalf("retry: %v", err)
	}
	if amounts := harness.Flutterwave.RefundAmountsMinor(); len(amounts) != 1 || amounts[0] != 450_000 {
		t.Fatalf("only the checkmark share is refunded, once: %v", harness.Flutterwave.Refunds)
	}
	entry, found, err := harness.Ledger.FindJournalEntryByReference(ctx, harness.Database, request.Reference)
	if err != nil || !found || entry.Kind != "verification.checkmarkShareRefunded" {
		t.Fatalf("ledger entry keyed by the idempotency reference: found=%v err=%v kind=%q", found, err, entry.Kind)
	}
	payable := ledgermodels.RefundsPayableAccount("flutterwave", "NGN")
	if balance, err := harness.Ledger.ReadAccountBalance(ctx, harness.Database, payable); err != nil || balance != 450_000 {
		t.Fatalf("the retry must not post the share twice: balance=%d err=%v", balance, err)
	}
	if _, err := gateway.RefundBillingSubscriptionPartially(ctx, paymentservices.PartialBillingRefund{BillingReference: "sub-charge-1", Reference: request.Reference, AmountMinor: 1, Currency: "NGN"}); err == nil {
		t.Fatal("reusing the reference with a different amount must be refused")
	}
}
