package removestaffmember

import (
	"github.com/google/uuid"

	catalogservices "zudomart/modules/catalog/src/services"
	"zudomart/platform/commerceports"
)

type Command struct {
	Store    commerceports.StoreAccess
	Actor    catalogservices.StoreActor
	MemberId uuid.UUID
}
