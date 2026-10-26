package createadset

import (
	"github.com/google/uuid"

	"nantty/modules/ads/src/modules/campaigns/dtos"
)

type Command struct {
	AccountId uuid.UUID
	UserId    uuid.UUID
	Request   dtos.CreateAdSetRequest
}
