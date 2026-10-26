package upsertprofilesignals

import (
	"github.com/google/uuid"

	"nantty/modules/users/src/modules/creatorProgram/dtos"
)

type Command struct {
	ProfileId uuid.UUID
	Input     dtos.ProfileSignalsRequest
}
