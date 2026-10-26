package services

import (
	"context"
	"fmt"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	inventoryerrors "nantty/modules/inventory/src/errors"
	"nantty/modules/inventory/src/generated/ent"
	"nantty/modules/inventory/src/generated/ent/predicate"
	"nantty/modules/inventory/src/generated/ent/stocklevel"
	"nantty/modules/inventory/src/generated/ent/stockmovement"
)

type StockChange struct {
	StoreId            uuid.UUID
	VariantId          uuid.UUID
	LocationId         uuid.UUID
	OnHandDelta        int
	ReservedDelta      int
	Kind               string
	Reference          string
	Reason             string
	Note               string
	ActorAccountId     *uuid.UUID
	ActorName          string
	DedupeKey          string
	AllowBelowReserved bool
}

func availableAtLeast(quantity int) predicate.StockLevel {
	return predicate.StockLevel(func(selector *sql.Selector) {
		selector.Where(sql.P(func(builder *sql.Builder) { builder.WriteString("on_hand - reserved >= ").Arg(quantity) }))
	})
}

func ApplyStockChangeInTransaction(ctx context.Context, tx *ent.Tx, level *ent.StockLevel, change StockChange) (*ent.StockLevel, error) {
	if change.DedupeKey != "" {
		seen, err := tx.StockMovement.Query().Where(stockmovement.DedupeKey(change.DedupeKey)).Exist(ctx)
		if err != nil {
			return nil, err
		}
		if seen {
			return level, nil
		}
	}
	guards := []predicate.StockLevel{stocklevel.ID(level.ID)}
	if change.OnHandDelta < 0 {
		guards = append(guards, stocklevel.OnHandGTE(-change.OnHandDelta))
	}
	if change.ReservedDelta < 0 {
		guards = append(guards, stocklevel.ReservedGTE(-change.ReservedDelta))
	}
	if change.ReservedDelta > 0 {
		guards = append(guards, availableAtLeast(change.ReservedDelta))
	}
	if change.OnHandDelta < 0 && !change.AllowBelowReserved {
		guards = append(guards, predicate.StockLevel(func(selector *sql.Selector) {
			selector.Where(sql.P(func(builder *sql.Builder) {
				builder.WriteString("on_hand + ").Arg(change.OnHandDelta).WriteString(" >= reserved + ").Arg(change.ReservedDelta)
			}))
		}))
	}
	affected, err := tx.StockLevel.Update().Where(guards...).AddOnHand(change.OnHandDelta).AddReserved(change.ReservedDelta).Save(ctx)
	if err != nil {
		return nil, err
	}
	if affected != 1 {
		return nil, inventoryerrors.InsufficientStock
	}
	if err := recordMovement(ctx, tx, change); err != nil {
		return nil, err
	}
	return tx.StockLevel.Get(ctx, level.ID)
}

func recordMovement(ctx context.Context, tx *ent.Tx, change StockChange) error {
	create := tx.StockMovement.Create().
		SetStoreID(change.StoreId).SetVariantID(change.VariantId).SetLocationID(change.LocationId).
		SetKind(change.Kind).SetOnHandDelta(change.OnHandDelta).SetReservedDelta(change.ReservedDelta).
		SetReference(change.Reference).SetReason(change.Reason).SetNote(change.Note).SetActorName(change.ActorName)
	if change.ActorAccountId != nil {
		create.SetActorAccountID(*change.ActorAccountId)
	}
	if change.DedupeKey != "" {
		create.SetDedupeKey(change.DedupeKey)
	}
	return create.Exec(ctx)
}

func MovementDedupeKey(kind, reference string, variantId, locationId uuid.UUID) string {
	return fmt.Sprintf("%s:%s:%s:%s", kind, reference, variantId, locationId)
}

func LockStockLevelsForVariants(ctx context.Context, tx *ent.Tx, variantIds []uuid.UUID) ([]*ent.StockLevel, error) {
	return tx.StockLevel.Query().Where(stocklevel.VariantIDIn(variantIds...)).Order(ent.Asc(stocklevel.FieldID)).ForUpdate().All(ctx)
}
