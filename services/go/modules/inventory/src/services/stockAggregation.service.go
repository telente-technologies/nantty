package services

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/generated/ent"
	"nantty/modules/inventory/src/generated/ent/predicate"
	"nantty/modules/inventory/src/generated/ent/stocklevel"
)

type StockAggregate struct {
	Variants          map[uuid.UUID]bool
	OnHand            int
	Reserved          int
	Available         int
	LowStockCount     int
	OutOfStockCount   int
	NeedsReorderCount int
	StockValueMinor   int64
	RetailValueMinor  int64
}

func (aggregate *StockAggregate) add(level *ent.StockLevel, costMinor, retailMinor int64) {
	available := level.OnHand - level.Reserved
	aggregate.Variants[level.VariantID] = true
	aggregate.OnHand += level.OnHand
	aggregate.Reserved += level.Reserved
	aggregate.Available += max(available, 0)
	switch {
	case available <= 0:
		aggregate.OutOfStockCount++
	case available <= level.LowStockLevel:
		aggregate.LowStockCount++
	}
	if available <= level.ReorderPoint {
		aggregate.NeedsReorderCount++
	}
	aggregate.StockValueMinor += costMinor * int64(max(level.OnHand, 0))
	aggregate.RetailValueMinor += retailMinor * int64(max(level.OnHand, 0))
}

func newAggregate() *StockAggregate { return &StockAggregate{Variants: map[uuid.UUID]bool{}} }

func AggregateListedStock(ctx context.Context, deployed *container.Container, storeId uuid.UUID, locationId *uuid.UUID) (*StockAggregate, map[uuid.UUID]*StockAggregate, error) {
	total, perLocation := newAggregate(), map[uuid.UUID]*StockAggregate{}
	conditions := []predicate.StockLevel{stocklevel.StoreID(storeId), stocklevel.Listed(true)}
	if locationId != nil {
		conditions = append(conditions, stocklevel.LocationID(*locationId))
	}
	var after *uuid.UUID
	for {
		query := deployed.Client.StockLevel.Query().Where(conditions...).Order(ent.Asc(stocklevel.FieldID)).Limit(1000)
		if after != nil {
			query = query.Where(stocklevel.IDGT(*after))
		}
		levels, err := query.All(ctx)
		if err != nil || len(levels) == 0 {
			return total, perLocation, err
		}
		descriptions, err := DescribeVariantsOfStore(ctx, storeId, UniqueVariantIds(levels, func(level *ent.StockLevel) uuid.UUID { return level.VariantID }))
		if err != nil {
			return nil, nil, err
		}
		for _, level := range levels {
			description := descriptions[level.VariantID]
			var cost int64
			if description.CostPrice != nil {
				cost = description.CostPrice.AmountMinor
			}
			if perLocation[level.LocationID] == nil {
				perLocation[level.LocationID] = newAggregate()
			}
			total.add(level, cost, description.RetailPrice.AmountMinor)
			perLocation[level.LocationID].add(level, cost, description.RetailPrice.AmountMinor)
		}
		after = &levels[len(levels)-1].ID
	}
}
