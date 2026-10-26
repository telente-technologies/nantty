package changeboostbudget

import (
	"github.com/google/uuid"

	"nantty/modules/ads/src/modules/boosts/dtos"
)

type Command struct {
	BoostId        uuid.UUID
	UserId         uuid.UUID
	IdempotencyKey string
	Request        dtos.BoostBudgetChangeRequest
}
