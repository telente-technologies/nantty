package updatestorelocation

import (
	"github.com/google/uuid"

	"nantty/modules/inventory/src/modules/locations/dtos"
	"nantty/platform/commerceports"
)

type Command struct {
	Store      commerceports.StoreAccess
	LocationId uuid.UUID
	Request    dtos.UpdateLocationRequest
}
