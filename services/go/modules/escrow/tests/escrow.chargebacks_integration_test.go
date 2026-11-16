package escrow_test

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"

	escrowservices "nantty/modules/escrow/src/modules/escrows/services"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
)

func TestAChargebackFreezesEscrowAndALostChargebackIsTakenFromTheSellerAccount(t *testing.T) {
	harness := startEscrowHarness(t)
	buyer, orderId := uuid.NewString(), uuid.NewString()
	harness.registerCheckout(buyer, map[string]int64{orderId: 400_000})
	reference := harness.payAndSettle(buyer, orderId)
	mustRunInTransaction(t, harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
		_, err := harness.escrow.Application.Escrows.RecordOrderFulfilmentInTransaction(ctx, transaction, escrowservices.OrderFulfilment{OrderId: orderId, Stage: "delivered", OccurredAt: harness.clock.Add(-time.Hour)})
		return err
	})
	chargeback, opened := harness.Flutterwave.OpenChargeback(reference, 0)
	if !opened {
		t.Fatal("no chargeback opened")
	}
	if _, err := harness.Payments.Application.Gateway.PollOpenProviderDisputes(context.Background()); err != nil {
		t.Fatal(err)
	}
	harness.clock = harness.clock.Add(200 * time.Hour)
	if released, _ := harness.escrow.Application.Escrows.ReleaseEscrowsWhoseInspectionPeriodEnded(context.Background(), 10); released != 0 {
		t.Fatal("a charged-back escrow was auto-released")
	}
	harness.Flutterwave.ResolveChargeback(fmt.Sprint(chargeback["id"]), false)
	if _, err := harness.Payments.Application.Gateway.PollOpenProviderDisputes(context.Background()); err != nil {
		t.Fatal(err)
	}
	harness.RunMoneyWorkers()
	escrowId := escrowIdForOrder(t, harness, orderId)
	if harness.balance(ledgermodels.WalletEscrowLockedAccount(buyer, escrowId, "NGN")) != 0 || harness.balance(ledgermodels.PlatformChargebackReceivableAccount("flutterwave", "NGN")) != 0 {
		t.Fatalf("a lost chargeback is recovered from the locked escrow in the buyer's wallet: %v", harness.NonZeroBalances())
	}
	harness.AssertLedgerHealthy()
}
