package payments

import (
	"context"
	"testing"

	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentstesting "zudomart/modules/payments/src/integrations/paymentsTesting"
	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
)

func TestCheckmarkShareRefundPostsOneLedgerEntryAcrossRetries(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	harness.Paystack.Transactions["sub-charge-1"] = &paymentstesting.FakeTransaction{Reference: "sub-charge-1", AmountMinor: 1_500_000, Currency: "NGN", Channel: "card", Status: "success"}
	gateway := harness.Payments.Application.Gateway
	request := paymentservices.PartialBillingRefund{BillingReference: "sub-charge-1", Reference: "verification-share:case-1", AmountMinor: 450_000, Currency: "NGN", Reason: "Checkmark verification rejected"}
	ctx := context.Background()

	harness.Paystack.FailNextRequests = 1
	if _, err := gateway.RefundBillingSubscriptionPartially(ctx, request); err == nil {
		t.Fatal("a provider outage must surface so the refund is retried")
	}
	if _, err := gateway.RefundBillingSubscriptionPartially(ctx, request); err != nil {
		t.Fatalf("retry: %v", err)
	}
	if len(harness.Paystack.Refunds) != 1 || harness.Paystack.Refunds[0]["amount"] != int64(450_000) {
		t.Fatalf("only the checkmark share is refunded, once: %v", harness.Paystack.Refunds)
	}
	entry, found, err := harness.Ledger.FindJournalEntryByReference(ctx, harness.Database, request.Reference)
	if err != nil || !found || entry.Kind != "verification.checkmarkShareRefunded" {
		t.Fatalf("ledger entry keyed by the idempotency reference: found=%v err=%v kind=%q", found, err, entry.Kind)
	}
	payable := ledgermodels.RefundsPayableAccount("paystack", "NGN")
	if balance, err := harness.Ledger.ReadAccountBalance(ctx, harness.Database, payable); err != nil || balance != 450_000 {
		t.Fatalf("the retry must not post the share twice: balance=%d err=%v", balance, err)
	}
	if _, err := gateway.RefundBillingSubscriptionPartially(ctx, paymentservices.PartialBillingRefund{BillingReference: "sub-charge-1", Reference: request.Reference, AmountMinor: 1, Currency: "NGN"}); err == nil {
		t.Fatal("reusing the reference with a different amount must be refused")
	}
}
