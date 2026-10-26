package applystockadjustments

import (
	"github.com/google/uuid"

	"nantty/modules/inventory/src/modules/adjustments/dtos"
	"nantty/platform/commerceports"
)

type Command struct {
	Store          commerceports.StoreAccess
	ActorAccountId uuid.UUID
	IdempotencyKey string
	Request        dtos.AdjustmentRequest
}
