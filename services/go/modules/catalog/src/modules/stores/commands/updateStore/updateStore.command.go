package updatestore

import (
	"nantty/modules/catalog/src/modules/stores/dtos"
	"nantty/platform/commerceports"
)

type Command struct {
	Store   commerceports.StoreAccess
	Request dtos.UpdateStoreRequest
}
