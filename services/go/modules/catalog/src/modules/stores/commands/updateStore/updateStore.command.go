package updatestore

import (
	"zudomart/modules/catalog/src/modules/stores/dtos"
	"zudomart/platform/commerceports"
)

type Command struct {
	Store   commerceports.StoreAccess
	Request dtos.UpdateStoreRequest
}
