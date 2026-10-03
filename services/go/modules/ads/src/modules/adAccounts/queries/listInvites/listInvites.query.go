package listinvites

import "github.com/google/uuid"

type Query struct {
	AccountId uuid.UUID
	UserId    uuid.UUID
}
