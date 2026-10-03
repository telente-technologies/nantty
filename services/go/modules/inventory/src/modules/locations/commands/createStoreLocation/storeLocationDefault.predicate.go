package createstorelocation

import (
	"github.com/google/uuid"

	"zudomart/modules/inventory/src/generated/ent/predicate"
	"zudomart/modules/inventory/src/generated/ent/stocklocation"
)

func stockLocationDefaultOf(storeId uuid.UUID) predicate.StockLocation {
	return stocklocation.And(stocklocation.StoreID(storeId), stocklocation.IsDefault(true))
}
