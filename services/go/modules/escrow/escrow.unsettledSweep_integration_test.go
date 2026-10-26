package escrow

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/google/uuid"

	escrowservices "nantty/modules/escrow/src/modules/escrows/services"
)

func TestAnUnsettledCardEscrowDoesNotBlockTheAutoReleaseOfOthers(t *testing.T) {
	harness := startEscrowHarness(t)
	buyer, settledOrder, unsettledOrder := uuid.NewString(), uuid.NewString(), uuid.NewString()
	harness.registerCheckout(buyer, map[string]int64{settledOrder: 200_000})
	harness.payAndSettle(buyer, settledOrder)
	harness.registerCheckout(buyer, map[string]int64{unsettledOrder: 100_000})
	harness.payCheckoutThroughWebhook(buyer, unsettledOrder, 0)
	for _, orderId := range []string{settledOrder, unsettledOrder} {
		mustRunInTransaction(t, harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
			_, err := harness.escrow.Application.Escrows.RecordOrderFulfilmentInTransaction(ctx, transaction, escrowservices.OrderFulfilment{OrderId: orderId, Stage: "delivered", OccurredAt: harness.clock.Add(-time.Hour)})
			return err
		})
	}
	schema := harness.escrow.Application.Container.Settings.Money.DatabaseSchema
	if _, err := harness.Database.Exec(`UPDATE "`+schema+`".escrows SET auto_release_at = auto_release_at - interval '1 hour' WHERE order_id = $1`, unsettledOrder); err != nil {
		t.Fatal(err)
	}
	harness.clock = harness.clock.Add(80 * time.Hour)
	released, err := harness.escrow.Application.Escrows.ReleaseEscrowsWhoseInspectionPeriodEnded(context.Background(), 10)
	if err != nil || released != 1 {
		t.Fatalf("the settled escrow must be released past the unsettled one: released %d, err %v", released, err)
	}
	harness.AssertLedgerHealthy()
}
