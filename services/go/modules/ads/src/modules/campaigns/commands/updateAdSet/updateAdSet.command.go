package updateadset

import (
	"github.com/google/uuid"

	"nantty/modules/ads/src/modules/campaigns/dtos"
)

type Command struct {
	AccountId uuid.UUID
	AdSetId   uuid.UUID
	UserId    uuid.UUID
	Patch     dtos.AdSetPatch
}
