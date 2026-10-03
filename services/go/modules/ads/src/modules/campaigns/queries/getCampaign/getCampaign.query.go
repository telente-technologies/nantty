package getcampaign

import "github.com/google/uuid"

type Query struct {
	AccountId  uuid.UUID
	CampaignId uuid.UUID
	UserId     uuid.UUID
	From       string
	To         string
}
