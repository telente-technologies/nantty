package services

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/escrow/src/generated/ent"
	"zudomart/modules/escrow/src/generated/ent/escrow"
	"zudomart/modules/escrow/src/generated/ent/pendingrefund"
	"zudomart/modules/ledger/src/databases"
)

const refundWaitingAlertAfter = 72 * time.Hour

func (service EscrowService) ExecuteDueScheduledRefunds(ctx context.Context, limit int) int {
	client := service.Container.Client(service.Container.Resources.Database)
	due, err := client.PendingRefund.Query().
		Where(pendingrefund.StatusEQ(pendingrefund.StatusScheduled), pendingrefund.HasEscrowWith(escrow.WalletFundedAtNotNil())).
		Order(ent.Asc(pendingrefund.FieldCreatedAt)).Limit(limit).All(ctx)
	if err != nil {
		service.Container.Resources.Logger.WarnContext(ctx, "could not list scheduled refunds", "error", err)
		return 0
	}
	seen := map[uuid.UUID]bool{}
	executed := 0
	for _, refund := range due {
		if seen[refund.EscrowID] {
			continue
		}
		seen[refund.EscrowID] = true
		count := 0
		err := databases.RunInMoneyTransaction(ctx, service.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
			if _, err := service.Container.Client(transaction).Escrow.Query().Where(escrow.ID(refund.EscrowID)).ForUpdate().Only(ctx); err != nil {
				return err
			}
			var err error
			count, err = service.ExecuteScheduledRefundsInTransaction(ctx, transaction, refund.EscrowID)
			return err
		})
		if err == nil {
			executed += count
		} else {
			service.Container.Resources.Logger.WarnContext(ctx, "scheduled refunds did not run; retried on the next sweep", "orderId", refund.OrderID, "error", err)
		}
	}
	service.alertOnRefundsWaitingTooLong(ctx)
	return executed
}

func (service EscrowService) alertOnRefundsWaitingTooLong(ctx context.Context) {
	client := service.Container.Client(service.Container.Resources.Database)
	cutoff := service.Container.Now().UTC().Add(-refundWaitingAlertAfter)
	stale, err := client.PendingRefund.Query().
		Where(pendingrefund.StatusEQ(pendingrefund.StatusScheduled), pendingrefund.CreatedAtLT(cutoff)).Limit(20).All(ctx)
	if err != nil {
		return
	}
	for _, refund := range stale {
		service.Container.Payments.RecordPaymentAlertMetric(ctx, "scheduledRefundWaitingForSettlement", "orderId", refund.OrderID, "pendingRefundId", refund.ID.String())
	}
}

func (service EscrowService) RunScheduledRefundSweepUntilContextDone(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			service.ExecuteDueScheduledRefunds(ctx, 100)
		}
	}
}
