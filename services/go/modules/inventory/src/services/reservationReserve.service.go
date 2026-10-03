package services

import (
	"context"
	"slices"

	"github.com/google/uuid"

	"zudomart/modules/inventory/src/container"
	"zudomart/modules/inventory/src/enums"
	inventoryerrors "zudomart/modules/inventory/src/errors"
	"zudomart/modules/inventory/src/events"
	"zudomart/modules/inventory/src/generated/ent"
	"zudomart/modules/inventory/src/generated/ent/stockreservation"
	"zudomart/platform/commerceports"
	"zudomart/platform/httpserver"
)

type ReservationService struct {
	Container *container.Container
}

func mergeStockLines(lines []commerceports.StockLine) ([]commerceports.StockLine, error) {
	merged := map[uuid.UUID]commerceports.StockLine{}
	for _, line := range lines {
		if line.Quantity <= 0 {
			return nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "lines", Message: "quantity must be positive"}})
		}
		existing := merged[line.VariantId]
		line.Quantity += existing.Quantity
		merged[line.VariantId] = line
	}
	result := make([]commerceports.StockLine, 0, len(merged))
	for _, line := range merged {
		result = append(result, line)
	}
	slices.SortFunc(result, func(left, right commerceports.StockLine) int {
		return slices.Compare(left.VariantId[:], right.VariantId[:])
	})
	return result, nil
}

func (service ReservationService) Reserve(ctx context.Context, request commerceports.ReserveStockRequest) error {
	lines, err := mergeStockLines(request.Lines)
	if err != nil || request.Reference == "" || len(lines) == 0 {
		return firstNonNil(err, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "reference", Message: "reference and lines are required"}}))
	}
	return service.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		return service.reserveInTransaction(ctx, tx, lines, request)
	})
}

func (service ReservationService) reserveInTransaction(ctx context.Context, tx *ent.Tx, lines []commerceports.StockLine, request commerceports.ReserveStockRequest) error {
	existing, err := tx.StockReservation.Query().Where(stockreservation.Reference(request.Reference)).All(ctx)
	if err != nil {
		return err
	}
	if len(existing) > 0 {
		return verifyExistingReservationMatches(existing, lines)
	}
	variantIds := make([]uuid.UUID, 0, len(lines))
	for _, line := range lines {
		variantIds = append(variantIds, line.VariantId)
	}
	levels, err := LockStockLevelsForVariants(ctx, tx, variantIds)
	if err != nil {
		return err
	}
	for _, line := range lines {
		if err := service.reserveLineInTransaction(ctx, tx, levels, line, request); err != nil {
			return err
		}
	}
	return events.EnqueueOutboxEventInTransaction(ctx, tx, "reservation.created", request.Reference, service.Container.Now(), map[string]any{
		"reference": request.Reference, "expiresAt": request.ExpiresAt, "lines": lines,
	})
}

func (service ReservationService) reserveLineInTransaction(ctx context.Context, tx *ent.Tx, levels []*ent.StockLevel, line commerceports.StockLine, request commerceports.ReserveStockRequest) error {
	byId := map[uuid.UUID]*ent.StockLevel{}
	capacities := []LevelCapacity{}
	for _, level := range levels {
		if level.VariantID == line.VariantId && level.StoreID == line.StoreId {
			byId[level.ID] = level
			capacities = append(capacities, LevelCapacity{LevelId: level.ID, LocationId: level.LocationID, OnHand: level.OnHand, Reserved: level.Reserved})
		}
	}
	allocations, enough := AllocateAcrossLocations(capacities, line.Quantity)
	if !enough {
		return commerceports.InsufficientStockError{VariantId: line.VariantId, Requested: line.Quantity, Available: TotalAvailable(capacities)}
	}
	for _, allocation := range allocations {
		if _, err := ApplyStockChangeInTransaction(ctx, tx, byId[allocation.LevelId], StockChange{
			StoreId: line.StoreId, VariantId: line.VariantId, LocationId: allocation.LocationId, ReservedDelta: allocation.Quantity,
			Kind: enums.MovementOrderReserved, Reference: request.Reference, ActorName: "checkout",
			DedupeKey: MovementDedupeKey(enums.MovementOrderReserved, request.Reference, line.VariantId, allocation.LocationId),
		}); err != nil {
			return err
		}
		create := tx.StockReservation.Create().SetReference(request.Reference).SetStoreID(line.StoreId).SetVariantID(line.VariantId).
			SetLocationID(allocation.LocationId).SetQuantity(allocation.Quantity)
		if !request.ExpiresAt.IsZero() {
			create.SetExpiresAt(request.ExpiresAt)
		}
		if err := create.Exec(ctx); err != nil {
			return err
		}
	}
	return nil
}

func verifyExistingReservationMatches(existing []*ent.StockReservation, lines []commerceports.StockLine) error {
	reserved := map[uuid.UUID]int{}
	for _, row := range existing {
		reserved[row.VariantID] += row.Quantity
	}
	for _, line := range lines {
		if reserved[line.VariantId] != line.Quantity {
			return inventoryerrors.ReservationConflict
		}
	}
	if len(reserved) != len(lines) {
		return inventoryerrors.ReservationConflict
	}
	return nil
}

func firstNonNil(left, right error) error {
	if left != nil {
		return left
	}
	return right
}
