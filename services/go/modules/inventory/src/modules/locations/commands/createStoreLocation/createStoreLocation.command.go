package createstorelocation

import (
	"nantty/modules/inventory/src/modules/locations/dtos"
	"nantty/platform/commerceports"
)

type Command struct {
	Store   commerceports.StoreAccess
	Request dtos.CreateLocationRequest
}
