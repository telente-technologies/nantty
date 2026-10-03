package createad

import (
	"github.com/google/uuid"

	"zudomart/modules/ads/src/modules/campaigns/dtos"
)

type Command struct {
	AccountId uuid.UUID
	UserId    uuid.UUID
	Request   dtos.CreateAdRequest
}
