package getadset

import "github.com/google/uuid"

type Query struct {
	AccountId uuid.UUID
	AdSetId   uuid.UUID
	UserId    uuid.UUID
	From      string
	To        string
}
