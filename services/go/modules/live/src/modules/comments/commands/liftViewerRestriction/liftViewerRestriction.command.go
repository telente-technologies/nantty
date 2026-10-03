package liftviewerrestriction

import (
	"github.com/google/uuid"
	"zudomart/modules/live/src/generated/ent/liverestriction"
	"zudomart/modules/live/src/types"
)

type Command struct {
	Actor  types.Actor
	LiveId uuid.UUID
	UserId uuid.UUID
	Kind   liverestriction.Kind
}
