package imposeviewerrestriction

import (
	"github.com/google/uuid"
	"nantty/modules/live/src/services"
	"nantty/modules/live/src/types"
)

type Command struct {
	Actor  types.Actor
	LiveId uuid.UUID
	UserId uuid.UUID
	Input  services.RestrictionInput
}
