package services

import (
	"context"

	"zudomart/modules/inventory/src/enums"
	inventoryerrors "zudomart/modules/inventory/src/errors"
	"zudomart/modules/inventory/src/events"
	"zudomart/modules/inventory/src/generated/ent"
	"zudomart/modules/inventory/src/generated/ent/stocklevel"
	"zudomart/modules/inventory/src/generated/ent/stockreservation"
	"zudomart/platform/commerceports"
)

func (service ReservationService) Fulfil(ctx context.Context, request commerceports.FulfilStockRequest) error {
	return service.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := service.Container.Now()
		rows, err := tx.StockReservation.Query().Where(stockreservation.Reference(request.Reference), stockreservation.StoreID(request.StoreId)).
			Order(ent.Asc(stockreservation.FieldVariantID, stockreservation.FieldLocationID)).ForUpdate().All(ctx)
		if err != nil {
			return err
		}
		if len(rows) == 0 {
			return inventoryerrors.NothingReservedForOrder
		}
		rows = rowsOfLatestAttempt(rows)
		if rows[0].Status == enums.ReservationFulfilled {
			return nil
		}
		for _, row := range rows {
			if row.Status != enums.ReservationActive && row.Status != enums.ReservationConfirmed {
				return inventoryerrors.ReservationNotActive
			}
			if err := service.shipReservedUnitsInTransaction(ctx, tx, row, request); err != nil {
				return err
			}
			if err := tx.StockReservation.UpdateOneID(row.ID).SetStatus(enums.ReservationFulfilled).SetSettledAt(now).ClearExpiresAt().Exec(ctx); err != nil {
				return err
			}
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "stock.fulfilled", request.Reference, now, map[string]any{"reference": request.Reference, "storeId": request.StoreId})
	})
}

func (service ReservationService) shipReservedUnitsInTransaction(ctx context.Context, tx *ent.Tx, row *ent.StockReservation, request commerceports.FulfilStockRequest) error {
	reservedLevel, err := tx.StockLevel.Query().Where(stocklevel.VariantID(row.VariantID), stocklevel.LocationID(row.LocationID)).ForUpdate().Only(ctx)
	if err != nil {
		return err
	}
	actor := request.ActorName
	if request.FromLocationId == nil || *request.FromLocationId == row.LocationID {
		_, err = ApplyStockChangeInTransaction(ctx, tx, reservedLevel, StockChange{
			StoreId: row.StoreID, VariantId: row.VariantID, LocationId: row.LocationID, OnHandDelta: -row.Quantity, ReservedDelta: -row.Quantity,
			Kind: enums.MovementOrderShipped, Reference: row.Reference, ActorName: actor,
			DedupeKey: MovementDedupeKey(enums.MovementOrderShipped, reservationMovementReference(row.Reference, row.Attempt), row.VariantID, row.LocationID),
		})
		return err
	}
	if _, err := ApplyStockChangeInTransaction(ctx, tx, reservedLevel, StockChange{
		StoreId: row.StoreID, VariantId: row.VariantID, LocationId: row.LocationID, ReservedDelta: -row.Quantity,
		Kind: enums.MovementOrderReleased, Reference: row.Reference, Reason: "moved_to_shipping_location", ActorName: actor, AllowBelowReserved: true,
		DedupeKey: MovementDedupeKey(enums.MovementOrderReleased, reservationMovementReference(row.Reference, row.Attempt), row.VariantID, row.LocationID),
	}); err != nil {
		return err
	}
	shippingLevel, err := tx.StockLevel.Query().Where(stocklevel.VariantID(row.VariantID), stocklevel.LocationID(*request.FromLocationId), stocklevel.StoreID(row.StoreID)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return inventoryerrors.InsufficientStock
	}
	if err != nil {
		return err
	}
	_, err = ApplyStockChangeInTransaction(ctx, tx, shippingLevel, StockChange{
		StoreId: row.StoreID, VariantId: row.VariantID, LocationId: *request.FromLocationId, OnHandDelta: -row.Quantity,
		Kind: enums.MovementOrderShipped, Reference: row.Reference, ActorName: actor,
		DedupeKey: MovementDedupeKey(enums.MovementOrderShipped, reservationMovementReference(row.Reference, row.Attempt), row.VariantID, *request.FromLocationId),
	})
	return err
}

func (service ReservationService) Restock(ctx context.Context, request commerceports.RestockRequest) error {
	lines, err := mergeStockLines(request.Lines)
	if err != nil {
		return err
	}
	return service.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		for _, line := range lines {
			level, err := tx.StockLevel.Query().Where(stocklevel.VariantID(line.VariantId), stocklevel.LocationID(request.LocationId), stocklevel.StoreID(request.StoreId)).ForUpdate().Only(ctx)
			if ent.IsNotFound(err) {
				return inventoryerrors.VariantNotFound
			}
			if err != nil {
				return err
			}
			if _, err := ApplyStockChangeInTransaction(ctx, tx, level, StockChange{
				StoreId: request.StoreId, VariantId: line.VariantId, LocationId: request.LocationId, OnHandDelta: line.Quantity,
				Kind: enums.MovementOrderReturned, Reference: request.Reference, ActorName: request.ActorName,
				DedupeKey: MovementDedupeKey(enums.MovementOrderReturned, request.Reference, line.VariantId, request.LocationId),
			}); err != nil {
				return err
			}
		}
		return nil
	})
}
