package services

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/generated/ent"
	"nantty/modules/inventory/src/generated/ent/stocklevel"
	"nantty/platform/commerceports"
)

func SeedZeroStockRowsForLocation(ctx context.Context, deployed *container.Container, storeId, locationId uuid.UUID, variants []commerceports.VariantReference) error {
	if len(variants) == 0 {
		return nil
	}
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		template, err := tx.StockLevel.Query().Where(stocklevel.StoreID(storeId)).All(ctx)
		if err != nil {
			return err
		}
		settings := map[uuid.UUID]*ent.StockLevel{}
		for _, level := range template {
			settings[level.VariantID] = level
		}
		creates := make([]*ent.StockLevelCreate, 0, len(variants))
		for _, variant := range variants {
			create := tx.StockLevel.Create().SetStoreID(storeId).SetProductID(variant.ProductId).SetVariantID(variant.VariantId).SetLocationID(locationId)
			if existing := settings[variant.VariantId]; existing != nil {
				create.SetLowStockLevel(existing.LowStockLevel).SetReorderPoint(existing.ReorderPoint).SetReorderQuantity(existing.ReorderQuantity)
			}
			creates = append(creates, create)
		}
		return tx.StockLevel.CreateBulk(creates...).OnConflictColumns(stocklevel.FieldVariantID, stocklevel.FieldLocationID).DoNothing().Exec(ctx)
	})
}
