package updatecampaign

import (
	"github.com/google/uuid"

	"zudomart/modules/ads/src/modules/campaigns/dtos"
)

type Command struct {
	AccountId  uuid.UUID
	CampaignId uuid.UUID
	UserId     uuid.UUID
	Patch      dtos.CampaignPatch
}
