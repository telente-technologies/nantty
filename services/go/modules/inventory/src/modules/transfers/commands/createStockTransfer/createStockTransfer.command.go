package createstocktransfer

import (
	"github.com/google/uuid"

	"nantty/modules/inventory/src/modules/transfers/dtos"
	"nantty/platform/commerceports"
)

type Command struct {
	Store          commerceports.StoreAccess
	ActorAccountId uuid.UUID
	IdempotencyKey string
	Request        dtos.TransferRequest
}
