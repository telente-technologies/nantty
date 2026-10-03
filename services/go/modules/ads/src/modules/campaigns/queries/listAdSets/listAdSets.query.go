package listadsets

import "github.com/google/uuid"

type Query struct {
	AccountId  uuid.UUID
	UserId     uuid.UUID
	CampaignId *uuid.UUID
	From       string
	To         string
	Cursor     *uuid.UUID
	Limit      int
}
