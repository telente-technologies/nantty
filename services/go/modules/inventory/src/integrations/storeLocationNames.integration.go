package integrations

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/inventory/src/container"
	"zudomart/modules/inventory/src/generated/ent/stocklocation"
	"zudomart/platform/commerceports"
)

type StoreLocationNames struct {
	Container *container.Container
}

var _ commerceports.StoreLocationNamesReader = StoreLocationNames{}

func (reader StoreLocationNames) LocationNamesForStore(ctx context.Context, storeId uuid.UUID) (map[uuid.UUID]string, error) {
	rows, err := reader.Container.Client.StockLocation.Query().Where(stocklocation.StoreID(storeId)).All(ctx)
	names := map[uuid.UUID]string{}
	for _, row := range rows {
		names[row.ID] = row.Name
	}
	return names, err
}
