package liftviewerrestriction

import (
	"github.com/google/uuid"
	"nantty/modules/live/src/generated/ent/liverestriction"
	"nantty/modules/live/src/types"
)

type Command struct {
	Actor  types.Actor
	LiveId uuid.UUID
	UserId uuid.UUID
	Kind   liverestriction.Kind
}
