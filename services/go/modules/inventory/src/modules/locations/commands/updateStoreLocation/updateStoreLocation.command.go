package updatestorelocation

import (
	"github.com/google/uuid"

	"zudomart/modules/inventory/src/modules/locations/dtos"
	"zudomart/platform/commerceports"
)

type Command struct {
	Store      commerceports.StoreAccess
	LocationId uuid.UUID
	Request    dtos.UpdateLocationRequest
}
