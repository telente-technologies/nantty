package createsupplier

import (
	"nantty/modules/inventory/src/modules/suppliers/dtos"
	"nantty/platform/commerceports"
)

type Command struct {
	Store   commerceports.StoreAccess
	Request dtos.SupplierRequest
}
