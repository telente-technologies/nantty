package createboost

import (
	"github.com/google/uuid"

	"nantty/platform/regionpricing"

	"nantty/modules/ads/src/modules/boosts/dtos"
)

type Command struct {
	UserId         uuid.UUID
	IdempotencyKey string
	Country        regionpricing.Resolution
	Platform       string
	Request        dtos.CreateBoostRequest
}
