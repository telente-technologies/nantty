package removemember

import "github.com/google/uuid"

type Command struct {
	AccountId    uuid.UUID
	ActorUserId  uuid.UUID
	TargetUserId uuid.UUID
}
