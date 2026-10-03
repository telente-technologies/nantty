package getmedia

import "github.com/google/uuid"

type Query struct {
	AccountId uuid.UUID
	MediaId   uuid.UUID
	UserId    uuid.UUID
}
