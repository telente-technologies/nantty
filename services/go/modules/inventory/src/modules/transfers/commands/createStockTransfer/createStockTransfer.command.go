package createstocktransfer

import (
	"github.com/google/uuid"

	"zudomart/modules/inventory/src/modules/transfers/dtos"
	"zudomart/platform/commerceports"
)

type Command struct {
	Store          commerceports.StoreAccess
	ActorAccountId uuid.UUID
	IdempotencyKey string
	Request        dtos.TransferRequest
}
