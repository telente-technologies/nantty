package getsellertoday

import (
	"github.com/google/uuid"

	"zudomart/platform/commerceports"
)

type Query struct {
	Store         commerceports.StoreAccess
	ActorId       uuid.UUID
	AmountsHidden bool
}
