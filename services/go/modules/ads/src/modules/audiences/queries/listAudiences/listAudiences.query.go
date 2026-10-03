package listaudiences

import "github.com/google/uuid"

type Query struct {
	AccountId uuid.UUID
	UserId    uuid.UUID
	Type      string
	Cursor    *uuid.UUID
	Limit     int
}
