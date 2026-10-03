package duplicateproduct

import (
	"github.com/google/uuid"

	"zudomart/platform/commerceports"
)

type Command struct {
	Store     commerceports.StoreAccess
	ActorId   uuid.UUID
	ProductId uuid.UUID
}
