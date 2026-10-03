package createstorelocation

import (
	"zudomart/modules/inventory/src/modules/locations/dtos"
	"zudomart/platform/commerceports"
)

type Command struct {
	Store   commerceports.StoreAccess
	Request dtos.CreateLocationRequest
}
