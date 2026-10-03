package cancelstocktransfer

import (
	"github.com/google/uuid"

	"zudomart/platform/commerceports"
)

type Command struct {
	Store          commerceports.StoreAccess
	TransferId     uuid.UUID
	ActorAccountId uuid.UUID
	IdempotencyKey string
}
