package leavestageasguest

import (
	"zudomart/modules/live/src/types"

	"github.com/google/uuid"
)

type Command struct {
	Actor  types.Actor
	LiveId uuid.UUID
}
