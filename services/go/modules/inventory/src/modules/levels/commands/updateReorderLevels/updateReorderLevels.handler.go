package updatereorderlevels

import (
	"context"

	"nantty/modules/inventory/src/container"
	inventoryerrors "nantty/modules/inventory/src/errors"
	"nantty/modules/inventory/src/events"
	"nantty/modules/inventory/src/generated/ent"
	"nantty/modules/inventory/src/generated/ent/stocklevel"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		updated, err := tx.StockLevel.Update().Where(stocklevel.StoreID(command.Store.StoreId), stocklevel.VariantID(command.VariantId)).
			SetReorderPoint(command.ReorderPoint).SetReorderQuantity(command.ReorderQuantity).Save(ctx)
		if err != nil {
			return err
		}
		if updated == 0 {
			return inventoryerrors.VariantNotFound
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "reorderLevel.changed", command.VariantId.String(), handler.Container.Now(), map[string]any{
			"storeId": command.Store.StoreId, "variantId": command.VariantId, "reorderPoint": command.ReorderPoint, "reorderQuantity": command.ReorderQuantity,
		})
	})
}
