package services

import (
	"context"
	"time"

	"zudomart/modules/inventory/src/enums"
	inventoryerrors "zudomart/modules/inventory/src/errors"
	"zudomart/modules/inventory/src/events"
	"zudomart/modules/inventory/src/generated/ent"
	"zudomart/modules/inventory/src/generated/ent/stocklevel"
	"zudomart/modules/inventory/src/generated/ent/stockreservation"
)

func (service ReservationService) Release(ctx context.Context, reference string) error {
	return service.settleReference(ctx, reference, enums.ReservationReleased, false)
}

func (service ReservationService) settleReference(ctx context.Context, reference, finalStatus string, onlyExpired bool) error {
	return service.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := service.Container.Now()
		query := tx.StockReservation.Query().Where(stockreservation.Reference(reference),
			stockreservation.StatusIn(enums.ReservationActive, enums.ReservationConfirmed))
		if onlyExpired {
			query = query.Where(stockreservation.StatusEQ(enums.ReservationActive), stockreservation.ExpiresAtLTE(now))
		}
		rows, err := query.Order(ent.Asc(stockreservation.FieldVariantID, stockreservation.FieldLocationID)).ForUpdate().All(ctx)
		if err != nil || len(rows) == 0 {
			return err
		}
		for _, row := range rows {
			if err := service.returnReservedUnitsInTransaction(ctx, tx, row, finalStatus, now); err != nil {
				return err
			}
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "reservation."+finalStatus, reference, now, map[string]any{"reference": reference})
	})
}

func (service ReservationService) returnReservedUnitsInTransaction(ctx context.Context, tx *ent.Tx, row *ent.StockReservation, finalStatus string, now time.Time) error {
	level, err := tx.StockLevel.Query().Where(stocklevel.VariantID(row.VariantID), stocklevel.LocationID(row.LocationID)).ForUpdate().Only(ctx)
	if err != nil {
		return err
	}
	if _, err := ApplyStockChangeInTransaction(ctx, tx, level, StockChange{
		StoreId: row.StoreID, VariantId: row.VariantID, LocationId: row.LocationID, ReservedDelta: -row.Quantity,
		Kind: enums.MovementOrderReleased, Reference: row.Reference, Reason: finalStatus, ActorName: "checkout",
		DedupeKey: MovementDedupeKey(enums.MovementOrderReleased, reservationMovementReference(row.Reference, row.Attempt), row.VariantID, row.LocationID), AllowBelowReserved: true,
	}); err != nil {
		return err
	}
	return tx.StockReservation.UpdateOneID(row.ID).SetStatus(finalStatus).SetSettledAt(now).ClearExpiresAt().Exec(ctx)
}

func (service ReservationService) Confirm(ctx context.Context, reference string) error {
	return service.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		rows, err := tx.StockReservation.Query().Where(stockreservation.Reference(reference)).ForUpdate().All(ctx)
		if err != nil {
			return err
		}
		if len(rows) == 0 {
			return inventoryerrors.NothingReservedForOrder
		}
		rows = rowsOfLatestAttempt(rows)
		for _, row := range rows {
			if row.Status != enums.ReservationActive && row.Status != enums.ReservationConfirmed {
				return inventoryerrors.ReservationNotActive
			}
		}
		return tx.StockReservation.Update().Where(stockreservation.Reference(reference), stockreservation.Attempt(rows[0].Attempt), stockreservation.StatusEQ(enums.ReservationActive)).
			SetStatus(enums.ReservationConfirmed).ClearExpiresAt().Exec(ctx)
	})
}

func (service ReservationService) ExpireDueReservations(ctx context.Context, batch int) (int, error) {
	references, err := service.Container.Client.StockReservation.Query().
		Where(stockreservation.StatusEQ(enums.ReservationActive), stockreservation.ExpiresAtLTE(service.Container.Now())).
		Order(ent.Asc(stockreservation.FieldExpiresAt)).Limit(batch).
		Select(stockreservation.FieldReference).Strings(ctx)
	if err != nil {
		return 0, err
	}
	seen := map[string]bool{}
	for _, reference := range references {
		if seen[reference] {
			continue
		}
		seen[reference] = true
		if err := service.settleReference(ctx, reference, enums.ReservationExpired, true); err != nil {
			return len(seen), err
		}
	}
	return len(seen), nil
}
