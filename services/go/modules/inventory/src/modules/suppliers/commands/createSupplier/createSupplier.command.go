package createsupplier

import (
	"zudomart/modules/inventory/src/modules/suppliers/dtos"
	"zudomart/platform/commerceports"
)

type Command struct {
	Store   commerceports.StoreAccess
	Request dtos.SupplierRequest
}
