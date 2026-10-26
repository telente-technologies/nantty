package removestaffmember

import (
	"github.com/google/uuid"

	catalogservices "nantty/modules/catalog/src/services"
	"nantty/platform/commerceports"
)

type Command struct {
	Store    commerceports.StoreAccess
	Actor    catalogservices.StoreActor
	MemberId uuid.UUID
}
