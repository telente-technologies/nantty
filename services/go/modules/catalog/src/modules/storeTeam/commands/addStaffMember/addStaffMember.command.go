package addstaffmember

import (
	"nantty/modules/catalog/src/modules/storeTeam/dtos"
	catalogservices "nantty/modules/catalog/src/services"
	"nantty/platform/commerceports"
	"nantty/platform/sellerplans"
)

type Command struct {
	Store   commerceports.StoreAccess
	Actor   catalogservices.StoreActor
	Plan    sellerplans.Plan
	Request dtos.CreateStaffRequest
}
