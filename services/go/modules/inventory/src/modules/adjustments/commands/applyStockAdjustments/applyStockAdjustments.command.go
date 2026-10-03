package applystockadjustments

import (
	"github.com/google/uuid"

	"zudomart/modules/inventory/src/modules/adjustments/dtos"
	"zudomart/platform/commerceports"
)

type Command struct {
	Store          commerceports.StoreAccess
	ActorAccountId uuid.UUID
	IdempotencyKey string
	Request        dtos.AdjustmentRequest
}
