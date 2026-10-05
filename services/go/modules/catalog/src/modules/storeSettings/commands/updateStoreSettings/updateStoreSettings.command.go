package updatestoresettings

import (
	"zudomart/modules/catalog/src/modules/storeSettings/dtos"
	catalogservices "zudomart/modules/catalog/src/services"
	"zudomart/platform/commerceports"
)

type Command struct {
	Store   commerceports.StoreAccess
	Actor   catalogservices.StoreActor
	Request dtos.UpdateStoreSettingsRequest
}
