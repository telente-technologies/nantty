package deletecampaign

import "github.com/google/uuid"

type Command struct {
	AccountId  uuid.UUID
	CampaignId uuid.UUID
	UserId     uuid.UUID
}
