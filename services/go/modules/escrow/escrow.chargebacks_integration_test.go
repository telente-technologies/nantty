package escrow

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/google/uuid"

	escrowservices "zudomart/modules/escrow/src/modules/escrows/services"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
)

func TestAChargebackFreezesEscrowAndALostChargebackIsTakenFromTheSellerAccount(t *testing.T) {
	harness := startEscrowHarness(t)
	buyer, orderId := uuid.NewString(), uuid.NewString()
	harness.registerCheckout(buyer, map[string]int64{orderId: 400_000})
	reference := harness.payCheckoutThroughWebhook(buyer, orderId, 0)
	transaction := harness.Paystack.Transactions[reference]
	mustRunInTransaction(t, harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
		_, err := harness.escrow.Application.Escrows.RecordOrderFulfilmentInTransaction(ctx, transaction, escrowservices.OrderFulfilment{OrderId: orderId, Stage: "delivered", OccurredAt: harness.clock.Add(-time.Hour)})
		return err
	})
	dispute := map[string]any{"id": 77, "status": "awaiting-merchant-feedback", "currency": "NGN", "category": "fraud", "transaction": map[string]any{"id": transaction.Id, "reference": reference}}
	harness.DeliverPaystackEvent("charge.dispute.create", dispute)
	harness.clock = harness.clock.Add(200 * time.Hour)
	if released, _ := harness.escrow.Application.Escrows.ReleaseEscrowsWhoseInspectionPeriodEnded(context.Background(), 10); released != 0 {
		t.Fatal("a charged-back escrow was auto-released")
	}
	dispute["status"], dispute["resolution"] = "resolved", "merchant-accepted"
	harness.DeliverPaystackEvent("charge.dispute.resolve", dispute)
	sellerId := "seller-" + orderId[:4]
	if harness.balance(ledgermodels.SellerEscrowAccount(sellerId, escrowIdForOrder(t, harness, orderId), "NGN")) != 0 || harness.balance(ledgermodels.SellerDebtAccount(sellerId, "NGN")) != 12_000 {
		t.Fatal("lost chargeback not taken from escrow with the fee shortfall as seller debt")
	}
	harness.AssertLedgerHealthy()
}
