package listactivity

import "github.com/google/uuid"

type Query struct {
	AccountId  uuid.UUID
	UserId     uuid.UUID
	ObjectType string
	Cursor     *uuid.UUID
	Limit      int
}
