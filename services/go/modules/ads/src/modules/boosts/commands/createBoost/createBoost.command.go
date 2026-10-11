package createboost

import (
	"github.com/google/uuid"

	"zudomart/platform/regionpricing"

	"zudomart/modules/ads/src/modules/boosts/dtos"
)

type Command struct {
	UserId         uuid.UUID
	IdempotencyKey string
	Country        regionpricing.Resolution
	Platform       string
	Request        dtos.CreateBoostRequest
}
