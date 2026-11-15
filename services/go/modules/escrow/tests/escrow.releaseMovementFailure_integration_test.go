package escrow_test

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/escrow/src/generated/ent/escrow"
	escrowservices "nantty/modules/escrow/src/modules/escrows/services"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
)

func (harness *escrowHarness) failPendingReleaseMovement(escrowId string) {
	harness.T.Helper()
	mustRunInTransaction(harness.T, harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
		movement, err := harness.Payments.Application.Gateway.FindMovementBySubject(ctx, transaction, paymentmodels.MovementEscrowRelease, escrowId)
		if err != nil || movement == nil {
			harness.T.Fatalf("release movement: %v", err)
		}
		updated, err := movement.Update().SetStatus("failed").SetFailureReason("destination wallet frozen").SetFinishedAt(harness.clock).AddVersion(1).Save(ctx)
		if err != nil {
			return err
		}
		handler := escrowservices.EscrowMovementHandler{Service: harness.escrow.Application.Escrows, Kind: paymentmodels.MovementEscrowRelease}
		return handler.HandleMovementFailed(ctx, transaction, paymentservices.ConvertMovementToFinished(updated, "destination wallet frozen"))
	})
}

func TestAFailedReleaseMovementIsAnnouncedAndRetriedNotLeftHeldForever(t *testing.T) {
	harness := startEscrowHarness(t)
	buyer, orderId := uuid.NewString(), uuid.NewString()
	harness.registerCheckout(buyer, map[string]int64{orderId: 200_000})
	harness.payAndSettle(buyer, orderId)
	deliveredAt := harness.clock.UTC().Truncate(time.Second)
	harness.deliverOrderEvent("orderGroup.delivered", orderId, deliveredAt)
	harness.clock = deliveredAt.Add(72*time.Hour + time.Minute)
	if released := harness.sweep(); released != 1 {
		t.Fatalf("released: %d", released)
	}
	client := harness.escrow.Application.Container.Client(harness.Database)
	held := client.Escrow.Query().Where(escrow.OrderID(orderId)).OnlyX(context.Background())
	harness.failPendingReleaseMovement(held.ID.String())
	failed := client.Escrow.Query().Where(escrow.OrderID(orderId)).OnlyX(context.Background())
	if failed.Status != escrow.StatusHeld || failed.AutoReleaseAt == nil || harness.reviewStartedAt(orderId) != nil {
		t.Fatalf("a failed release goes back to held with a retry time, not to the undelivered review: %s %v", failed.Status, failed.AutoReleaseAt)
	}
	if data := harness.lastOutboxData("escrow.releaseFailed"); data["orderId"] != orderId {
		t.Fatalf("the order service is told the release failed: %v", data)
	}
	harness.clock = failed.AutoReleaseAt.Add(time.Minute)
	if released := harness.sweep(); released != 1 {
		t.Fatalf("the sweep retries the release: %d", released)
	}
	harness.RunMoneyWorkers()
	if after := client.Escrow.Query().Where(escrow.OrderID(orderId)).OnlyX(context.Background()); after.Status != escrow.StatusReleased {
		t.Fatalf("released on retry: %s", after.Status)
	}
	if got := harness.balance(ledgermodels.WalletDepositHoldAccount(sellerForOrder(orderId), "NGN")); got != held.SellerAmountMinor {
		t.Fatalf("the seller is paid once: %d, want %d", got, held.SellerAmountMinor)
	}
	harness.AssertLedgerHealthy()
}
