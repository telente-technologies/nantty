package previewinvite

import "github.com/google/uuid"

type Query struct {
	InviteId uuid.UUID
	UserId   uuid.UUID
}
