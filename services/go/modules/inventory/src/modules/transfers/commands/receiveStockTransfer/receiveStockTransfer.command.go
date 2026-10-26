package receivestocktransfer

import (
	"github.com/google/uuid"

	"nantty/platform/commerceports"
)

type Command struct {
	Store          commerceports.StoreAccess
	TransferId     uuid.UUID
	ActorAccountId uuid.UUID
	IdempotencyKey string
}
