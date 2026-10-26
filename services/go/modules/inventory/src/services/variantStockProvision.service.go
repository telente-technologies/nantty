package services

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/enums"
	"nantty/modules/inventory/src/generated/ent"
	"nantty/modules/inventory/src/generated/ent/stocklevel"
	"nantty/modules/inventory/src/generated/ent/stocklocation"
	"nantty/platform/commerceports"
)

func ProvisionVariantStock(ctx context.Context, deployed *container.Container, request commerceports.ProvisionVariantStockRequest) error {
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		locations, err := tx.StockLocation.Query().Where(stocklocation.StoreID(request.StoreId)).All(ctx)
		if err != nil {
			return err
		}
		opening := map[uuid.UUID]int{}
		for _, line := range request.Opening {
			opening[line.LocationId] = line.Quantity
		}
		for _, location := range locations {
			level, err := tx.StockLevel.Query().Where(stocklevel.VariantID(request.VariantId), stocklevel.LocationID(location.ID)).ForUpdate().Only(ctx)
			if ent.IsNotFound(err) {
				level, err = tx.StockLevel.Create().SetStoreID(request.StoreId).SetProductID(request.ProductId).SetVariantID(request.VariantId).
					SetLocationID(location.ID).SetLowStockLevel(request.LowStockLevel).SetReorderPoint(request.ReorderPoint).SetReorderQuantity(request.ReorderQuantity).SetListed(request.Listed).Save(ctx)
				if err != nil {
					return err
				}
				if quantity := opening[location.ID]; quantity > 0 {
					if _, err := ApplyStockChangeInTransaction(ctx, tx, level, StockChange{
						StoreId: request.StoreId, VariantId: request.VariantId, LocationId: location.ID, OnHandDelta: quantity,
						Kind: enums.MovementAdjustment, Reason: "received", Reference: "opening stock", ActorAccountId: &request.ActorAccountId,
						DedupeKey: MovementDedupeKey(enums.MovementAdjustment, "opening:"+request.MovementRefToken, request.VariantId, location.ID),
					}); err != nil {
						return err
					}
				}
				continue
			}
			if err != nil {
				return err
			}
			if err := tx.StockLevel.UpdateOneID(level.ID).SetLowStockLevel(request.LowStockLevel).SetReorderPoint(request.ReorderPoint).SetReorderQuantity(request.ReorderQuantity).SetListed(request.Listed).Exec(ctx); err != nil {
				return err
			}
		}
		return nil
	})
}

func SetProductListedInStock(ctx context.Context, deployed *container.Container, storeId, productId uuid.UUID, listed bool) error {
	return deployed.Client.StockLevel.Update().Where(stocklevel.StoreID(storeId), stocklevel.ProductID(productId)).SetListed(listed).Exec(ctx)
}
