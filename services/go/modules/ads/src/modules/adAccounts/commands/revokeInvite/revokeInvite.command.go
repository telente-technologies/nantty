package revokeinvite

import "github.com/google/uuid"

type Command struct {
	AccountId   uuid.UUID
	InviteId    uuid.UUID
	ActorUserId uuid.UUID
}
