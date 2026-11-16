package escrow_test

import (
	"context"
	"database/sql"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	escrowservices "nantty/modules/escrow/src/modules/escrows/services"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
)

func TestOnlyOneLiveAttemptAndALateSuccessOnASupersededAttemptIsRefunded(t *testing.T) {
	harness := startEscrowHarness(t)
	buyer, orderId := uuid.NewString(), uuid.NewString()
	harness.registerCheckout(buyer, map[string]int64{orderId: 300_000})
	first := harness.initializePayment(buyer, orderId, "attempt-key-1")
	second := harness.initializePayment(buyer, orderId, "attempt-key-2")
	if first.Status != http.StatusCreated || second.Status != http.StatusCreated || first.Body["reference"] == second.Body["reference"] {
		t.Fatalf("attempts: %d %d", first.Status, second.Status)
	}
	for _, attempt := range []HarnessReference{{first.Body["reference"].(string)}, {second.Body["reference"].(string)}} {
		harness.CompleteCheckoutThroughWebhook(attempt.reference, 0, processingFeeFor(300_000))
	}
	if harness.Flutterwave.Calls("POST /transactions") != 1 || harness.balance(ledgermodels.PaymentsAwaitingApplicationAccount("NGN")) != 0 {
		t.Fatalf("duplicate payment not refunded exactly once (refund calls %d)", harness.Flutterwave.Calls("POST /transactions"))
	}
	harness.deliverRefundProcessed(second.Body["reference"].(string))
	if harness.balance(ledgermodels.WalletInboundEscrowAccount(buyer, escrowIdForOrder(t, harness, orderId), "NGN")) != 300_000 || harness.balance(ledgermodels.RefundsPayableAccount("flutterwave", "NGN")) != 0 {
		t.Fatalf("the order was not held exactly once: %v", harness.NonZeroBalances())
	}
	harness.AssertLedgerHealthy()
}

func TestADisputePausesTheAutoReleaseTimerAndClosingItResumesTheRemainingWindow(t *testing.T) {
	harness := startEscrowHarness(t)
	buyer, orderId := uuid.NewString(), uuid.NewString()
	harness.registerCheckout(buyer, map[string]int64{orderId: 100_000})
	harness.payAndSettle(buyer, orderId)
	escrows := harness.escrow.Application.Escrows
	mustRunInTransaction(t, harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
		_, err := escrows.RecordOrderFulfilmentInTransaction(ctx, transaction, escrowservices.OrderFulfilment{OrderId: orderId, Stage: "delivered", OccurredAt: harness.clock.Add(-time.Hour)})
		return err
	})
	token := harness.Tokens.UserAccessToken(buyer)
	opened := harness.Call(http.MethodPost, "/api/v1/orders/"+orderId+"/disputes", token, "pause-dispute-1", map[string]any{"reason": "not_received", "description": "", "evidenceUrls": []string{}})
	harness.clock = harness.clock.Add(500 * time.Hour)
	if closed := harness.Call(http.MethodPost, "/api/v1/disputes/"+opened.Body["id"].(string)+"/close", token, "", nil); closed.Body["status"] != "closed" {
		t.Fatalf("close: %d %s", closed.Status, closed.Raw)
	}
	harness.clock = harness.clock.Add(70 * time.Hour)
	if released, _ := escrows.ReleaseEscrowsWhoseInspectionPeriodEnded(context.Background(), 10); released != 0 {
		t.Fatal("released before the remaining 71 hours elapsed")
	}
	harness.clock = harness.clock.Add(2 * time.Hour)
	if released, _ := escrows.ReleaseEscrowsWhoseInspectionPeriodEnded(context.Background(), 10); released != 1 {
		t.Fatal("not released after the remaining window")
	}
	harness.AssertLedgerHealthy()
}
