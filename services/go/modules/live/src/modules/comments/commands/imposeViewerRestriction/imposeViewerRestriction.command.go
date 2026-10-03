package imposeviewerrestriction

import (
	"github.com/google/uuid"
	"zudomart/modules/live/src/services"
	"zudomart/modules/live/src/types"
)

type Command struct {
	Actor  types.Actor
	LiveId uuid.UUID
	UserId uuid.UUID
	Input  services.RestrictionInput
}
