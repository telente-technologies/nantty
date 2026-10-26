package createstorelocation

import (
	"github.com/google/uuid"

	"nantty/modules/inventory/src/generated/ent/predicate"
	"nantty/modules/inventory/src/generated/ent/stocklocation"
)

func stockLocationDefaultOf(storeId uuid.UUID) predicate.StockLocation {
	return stocklocation.And(stocklocation.StoreID(storeId), stocklocation.IsDefault(true))
}
