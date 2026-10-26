package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"time"

	entsql "entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"nantty/modules/escrow/src/generated/ent"
	"nantty/modules/escrow/src/generated/ent/escrow"
	"nantty/modules/escrow/src/generated/ent/pendingrefund"
	"nantty/modules/ledger/src/databases"
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
	if isDirectSale(held) && fulfilment.Stage == "delivered" {
		return service.scheduleDirectOrderCompletionInTransaction(ctx, transaction, held, fulfilment.OccurredAt.UTC())
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
		if held.Status == escrow.StatusHeld {
			update.SetAutoReleaseAt(occurredAt.Add(service.Container.Policy(ctx).AutoReleasePeriod)).ClearUndeliveredReviewAt()
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
	if updated.AutoReleaseAt != nil && held.DeliveredAt == nil && updated.DeliveredAt != nil && held.Status == escrow.StatusHeld {
		data := escrowEventData(updated)
		data["autoReleaseAt"] = updated.AutoReleaseAt.UTC().Format(time.RFC3339)
		if err := service.Container.Outbox.EnqueueInTransaction(ctx, transaction, "escrow.releaseScheduled", updated.OrderID, occurredAt, data); err != nil {
			return nil, err
		}
	}
	return updated, nil
}

// scheduleDirectOrderCompletionInTransaction gives a direct-payment order the same inspection window as an escrow:
// the order service completes it automatically once the window passes unless the buyer confirms, disputes or asks for a refund first.
func (service EscrowService) scheduleDirectOrderCompletionInTransaction(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, occurredAt time.Time) (*ent.Escrow, error) {
	if held.AutoReleaseAt != nil {
		return held, nil
	}
	update := held.Update().AddVersion(1).SetAutoReleaseAt(occurredAt.Add(service.Container.Policy(ctx).AutoReleasePeriod))
	if held.DeliveredAt == nil {
		update.SetDeliveredAt(occurredAt)
	}
	updated, err := update.Save(ctx)
	if err != nil {
		return nil, err
	}
	data := escrowEventData(updated)
	data["autoReleaseAt"] = updated.AutoReleaseAt.UTC().Format(time.RFC3339)
	return updated, service.Container.Outbox.EnqueueInTransaction(ctx, transaction, "escrow.releaseScheduled", updated.OrderID, occurredAt, data)
}

func (service EscrowService) ReleaseEscrowsWhoseInspectionPeriodEnded(ctx context.Context, batchSize int) (int, error) {
	released := 0
	var skipped []uuid.UUID
	var failures []error
	for attempt := 0; attempt < batchSize && released < batchSize; attempt++ {
		var due *ent.Escrow
		var result EscrowSettlementResult
		reviewed := false
		err := databases.RunInMoneyTransaction(ctx, service.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
			due, result, reviewed = nil, EscrowSettlementResult{}, false
			var err error
			due, err = service.Container.Client(transaction).Escrow.Query().
				Where(escrow.StatusEQ(escrow.StatusHeld), escrow.AutoReleaseAtLTE(service.Container.Now().UTC()), escrow.IDNotIn(skipped...),
					escrow.Or(escrow.CustodyNEQ(escrow.CustodyBuyerWalletLock), escrow.WalletFundedAtNotNil()),
					escrow.Not(escrow.HasPendingRefundsWith(pendingrefund.StatusEQ(pendingrefund.StatusScheduled)))).
				Order(ent.Asc(escrow.FieldAutoReleaseAt)).ForUpdate(entsql.WithLockAction(entsql.SkipLocked)).First(ctx)
			if ent.IsNotFound(err) {
				due = nil
				return nil
			}
			if err != nil {
				return err
			}
			if due.DeliveredAt == nil && due.BuyerConfirmedAt == nil && due.ReleaseTrigger != ReleaseTriggerFailed {
				reviewed = true
				return service.moveUndeliveredEscrowToStaffReviewInTransaction(ctx, transaction, due)
			}
			result, err = service.ReleaseEscrowInTransaction(ctx, transaction, due.OrderID, "autoRelease", SystemActor)
			return err
		})
		if err != nil && due == nil {
			return released, errors.Join(append(failures, err)...)
		}
		if err != nil {
			skipped = append(skipped, due.ID)
			failures = append(failures, fmt.Errorf("escrow %s: %w", due.ID, err))
			service.Container.Payments.RecordPaymentAlertMetric(ctx, "escrowAutoReleaseDeadLetter", "escrowId", due.ID.String(), "orderId", due.OrderID, "error", err.Error())
			continue
		}
		if reviewed {
			continue
		}
		if result.Escrow == nil {
			break
		}
		released++
	}
	return released, errors.Join(failures...)
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
