package createaudience

import (
	"github.com/google/uuid"

	"zudomart/modules/ads/src/modules/audiences/dtos"
)

type Command struct {
	AccountId uuid.UUID
	UserId    uuid.UUID
	Request   dtos.CreateAudienceRequest
}
