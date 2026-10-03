package deleteaudience

import "github.com/google/uuid"

type Command struct {
	AccountId  uuid.UUID
	AudienceId uuid.UUID
	UserId     uuid.UUID
}
