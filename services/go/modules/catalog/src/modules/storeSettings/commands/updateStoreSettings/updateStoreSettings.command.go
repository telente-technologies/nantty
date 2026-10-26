package updatestoresettings

import (
	"nantty/modules/catalog/src/modules/storeSettings/dtos"
	catalogservices "nantty/modules/catalog/src/services"
	"nantty/platform/commerceports"
)

type Command struct {
	Store   commerceports.StoreAccess
	Actor   catalogservices.StoreActor
	Request dtos.UpdateStoreSettingsRequest
}
