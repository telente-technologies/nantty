package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/inventory/src/container"
	inventoryerrors "zudomart/modules/inventory/src/errors"
	"zudomart/modules/inventory/src/generated/ent"
	"zudomart/modules/inventory/src/generated/ent/stocklocation"
)

func ResolveLocationOfStore(ctx context.Context, deployed *container.Container, storeId uuid.UUID, requested *uuid.UUID) (*ent.StockLocation, error) {
	query := deployed.Client.StockLocation.Query().Where(stocklocation.StoreID(storeId))
	if requested != nil {
		query = query.Where(stocklocation.ID(*requested))
	} else {
		query = query.Where(stocklocation.IsDefault(true))
	}
	location, err := query.Only(ctx)
	if ent.IsNotFound(err) {
		return nil, inventoryerrors.InvalidStockLocation
	}
	return location, err
}
