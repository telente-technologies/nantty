package acceptinvite

import "github.com/google/uuid"

type Command struct {
	InviteId uuid.UUID
	UserId   uuid.UUID
}
