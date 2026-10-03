package listcampaigns

import "github.com/google/uuid"

type Query struct {
	AccountId uuid.UUID
	UserId    uuid.UUID
	Status    string
	Objective string
	Search    string
	From      string
	To        string
	Cursor    *uuid.UUID
	Limit     int
}
