package renameaudience

import (
	"github.com/google/uuid"

	"nantty/modules/ads/src/modules/audiences/dtos"
)

type Command struct {
	AccountId  uuid.UUID
	AudienceId uuid.UUID
	UserId     uuid.UUID
	Request    dtos.RenameRequest
}
