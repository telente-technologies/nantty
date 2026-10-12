package services

import (
	"context"
	"database/sql"
	"log/slog"
	"time"

	entsql "entgo.io/ent/dialect/sql"

	"zudomart/modules/escrow/src/generated/ent"
	"zudomart/modules/escrow/src/generated/ent/escrow"
	"zudomart/modules/escrow/src/generated/ent/pendingrefund"
	"zudomart/modules/ledger/src/databases"
)

type OrderFulfilment struct {
	OrderId             string
	Stage               string
	OccurredAt          time.Time
	CourierName         string
	TrackingNumber      string
	TrackingUrl         string
	EstimatedDeliveryAt *time.Time
}

func (service EscrowService) RecordOrderFulfilmentInTransaction(ctx context.Context, transaction *sql.Tx, fulfilment OrderFulfilment) (*ent.Escrow, error) {
	client := service.Container.Client(transaction)
	held, err := service.LockEscrowForOrder(ctx, client, fulfilment.OrderId)
	if err != nil {
		return nil, err
	}
	if held.Status != escrow.StatusHeld && held.Status != escrow.StatusDisputed {
		return held, nil
	}
	occurredAt := fulfilment.OccurredAt.UTC()
	update := held.Update().AddVersion(1)
	eventType := "shipped"
	switch fulfilment.Stage {
	case "shipped":
		if held.ShippedAt != nil || held.DeliveredAt != nil {
			return held, nil
		}
		update.SetShippedAt(occurredAt).SetCourierName(fulfilment.CourierName).SetTrackingNumber(fulfilment.TrackingNumber).SetTrackingURL(fulfilment.TrackingUrl).
			SetNillableEstimatedDeliveryAt(fulfilment.EstimatedDeliveryAt)
	case "delivered":
		if held.DeliveredAt != nil {
			return held, nil
		}
		eventType = "delivered"
		update.SetDeliveredAt(occurredAt)
		if held.ShippedAt == nil {
			update.SetShippedAt(occurredAt)
		}
		if held.Status == escrow.StatusHeld && held.AutoReleaseAt == nil {
			update.SetAutoReleaseAt(occurredAt.Add(service.Container.Policy(ctx).AutoReleasePeriod))
		}
	default:
		return nil, ErrInvalidFulfilmentStage
	}
	updated, err := update.Save(ctx)
	if err != nil {
		return nil, err
	}
	if err := service.recordEscrowEvent(ctx, client, held.ID, eventType, "system", "", map[string]any{"courierName": fulfilment.CourierName, "trackingNumber": fulfilment.TrackingNumber}); err != nil {
		return nil, err
	}
	if updated.AutoReleaseAt != nil && held.AutoReleaseAt == nil {
		data := escrowEventData(updated)
		data["autoReleaseAt"] = updated.AutoReleaseAt.UTC().Format(time.RFC3339)
		if err := service.Container.Outbox.EnqueueInTransaction(ctx, transaction, "escrow.releaseScheduled", updated.OrderID, occurredAt, data); err != nil {
			return nil, err
		}
	}
	return updated, nil
}

func (service EscrowService) ReleaseEscrowsWhoseInspectionPeriodEnded(ctx context.Context, batchSize int) (int, error) {
	released := 0
	for released < batchSize {
		var result EscrowSettlementResult
		err := databases.RunInMoneyTransaction(ctx, service.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
			result = EscrowSettlementResult{}
			due, err := service.Container.Client(transaction).Escrow.Query().
				Where(escrow.StatusEQ(escrow.StatusHeld), escrow.AutoReleaseAtLTE(service.Container.Now().UTC()),
					escrow.Or(escrow.CustodyNEQ(escrow.CustodyBuyerWalletLock), escrow.WalletFundedAtNotNil()),
					escrow.Not(escrow.HasPendingRefundsWith(pendingrefund.StatusEQ(pendingrefund.StatusScheduled)))).
				Order(ent.Asc(escrow.FieldAutoReleaseAt)).ForUpdate(entsql.WithLockAction(entsql.SkipLocked)).First(ctx)
			if ent.IsNotFound(err) {
				return nil
			}
			if err != nil {
				return err
			}
			result, err = service.ReleaseEscrowInTransaction(ctx, transaction, due.OrderID, "autoRelease", SystemActor)
			return err
		})
		if err != nil {
			return released, err
		}
		if result.Escrow == nil {
			return released, nil
		}
		released++
	}
	return released, nil
}

func (service EscrowService) RunAutoReleaseSweepUntilContextDone(ctx context.Context) {
	ticker := time.NewTicker(service.Container.Settings.AutoReleaseSweepInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if _, err := service.ReleaseEscrowsWhoseInspectionPeriodEnded(ctx, 100); err != nil && ctx.Err() == nil {
				service.Container.Resources.Logger.WarnContext(ctx, "escrow auto-release sweep failed", slog.Any("error", err))
			}
		}
	}
}
