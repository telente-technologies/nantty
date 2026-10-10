package createboost

import (
	"github.com/google/uuid"

	"zudomart/modules/ads/src/modules/boosts/dtos"
)

type Command struct {
	UserId         uuid.UUID
	IdempotencyKey string
	Country        string
	Platform       string
	Request        dtos.CreateBoostRequest
}
