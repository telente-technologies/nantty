package escrow

import (
	"context"
	"database/sql"
	"net/http"
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
	connectedAccountId := harness.ensureSellerOnboarded(orderId)
	checkout := harness.Bachs.Checkouts[reference]
	mustRunInTransaction(t, harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
		_, err := harness.escrow.Application.Escrows.RecordOrderFulfilmentInTransaction(ctx, transaction, escrowservices.OrderFulfilment{OrderId: orderId, Stage: "delivered", OccurredAt: harness.clock.Add(-time.Hour)})
		return err
	})
	dispute := map[string]any{"dispute_id": "dsp_test_1", "charge_id": checkout.ChargeId, "amount": "4000.00", "currency": "NGN", "status": "needs_response", "reason": "fraudulent"}
	harness.DeliverBachsEvent("dispute.created", connectedAccountId, dispute)
	harness.clock = harness.clock.Add(200 * time.Hour)
	if released, _ := harness.escrow.Application.Escrows.ReleaseEscrowsWhoseInspectionPeriodEnded(context.Background(), 10); released != 0 {
		t.Fatal("a charged-back escrow was auto-released")
	}
	if view := harness.Call(http.MethodGet, "/api/v1/orders/"+orderId+"/escrow", harness.Tokens.UserAccessToken(buyer), "", nil); view.Body["status"] != "disputed" && view.Body["stage"] != "disputed" {
		t.Logf("escrow view while charged back: %v", view.Body)
	}
	dispute["status"] = "lost"
	harness.Bachs.DebitLostDispute(connectedAccountId, "NGN", 400_000)
	harness.DeliverBachsEvent("dispute.updated", connectedAccountId, dispute)
	sellerId := "seller-" + orderId[:4]
	if harness.balance(ledgermodels.SellerEscrowAccount(sellerId, escrowIdForOrder(t, harness, orderId), "NGN")) != 0 ||
		harness.balance(ledgermodels.SellerDebtAccount(sellerId, "NGN")) != 26_000 || harness.balance(ledgermodels.SellerProviderHeldFundsAccount(sellerId, "NGN")) != -26_000 {
		t.Fatal("lost chargeback not booked against the seller's provider account with the fee shortfall as debt")
	}
	harness.AssertProviderMirrorMatches()
	harness.AssertLedgerHealthy()
}
