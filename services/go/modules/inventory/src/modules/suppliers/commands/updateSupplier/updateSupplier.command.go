package updatesupplier

import (
	"github.com/google/uuid"

	"nantty/modules/inventory/src/modules/suppliers/dtos"
	"nantty/platform/commerceports"
)

type Command struct {
	Store      commerceports.StoreAccess
	SupplierId uuid.UUID
	Request    dtos.SupplierRequest
}
