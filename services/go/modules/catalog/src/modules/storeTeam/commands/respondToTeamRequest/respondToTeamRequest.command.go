package respondtoteamrequest

import (
	"github.com/google/uuid"

	catalogservices "nantty/modules/catalog/src/services"
)

type Command struct {
	Actor    catalogservices.StoreActor
	MemberId uuid.UUID
	Accept   bool
}
