package addstaffmember

import (
	"zudomart/modules/catalog/src/modules/storeTeam/dtos"
	catalogservices "zudomart/modules/catalog/src/services"
	"zudomart/platform/commerceports"
	"zudomart/platform/sellerplans"
)

type Command struct {
	Store   commerceports.StoreAccess
	Actor   catalogservices.StoreActor
	Plan    sellerplans.Plan
	Request dtos.CreateStaffRequest
}
