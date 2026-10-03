package listcontentsources

import "github.com/google/uuid"

type Query struct {
	AccountId uuid.UUID
	UserId    uuid.UUID
	Type      string
	Search    string
	Cursor    string
	Limit     int
}
