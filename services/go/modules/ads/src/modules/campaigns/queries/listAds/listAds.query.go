package listads

import "github.com/google/uuid"

type Query struct {
	AccountId    uuid.UUID
	UserId       uuid.UUID
	CampaignId   *uuid.UUID
	AdSetId      *uuid.UUID
	ReviewStatus string
	From         string
	To           string
	Cursor       *uuid.UUID
	Limit        int
}
