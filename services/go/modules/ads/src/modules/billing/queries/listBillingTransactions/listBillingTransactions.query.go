package listbillingtransactions

import "github.com/google/uuid"

type Query struct {
	AccountId uuid.UUID
	UserId    uuid.UUID
	Cursor    *uuid.UUID
	Limit     int
}
