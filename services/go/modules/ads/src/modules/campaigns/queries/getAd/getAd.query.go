package getad

import "github.com/google/uuid"

type Query struct {
	AccountId uuid.UUID
	AdId      uuid.UUID
	UserId    uuid.UUID
	From      string
	To        string
}
