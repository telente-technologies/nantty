package updatesupplier

import (
	"github.com/google/uuid"

	"zudomart/modules/inventory/src/modules/suppliers/dtos"
	"zudomart/platform/commerceports"
)

type Command struct {
	Store      commerceports.StoreAccess
	SupplierId uuid.UUID
	Request    dtos.SupplierRequest
}
