package cancelguestinvitation

import (
	"zudomart/modules/live/src/types"

	"github.com/google/uuid"
)

type Command struct {
	Actor  types.Actor
	LiveId uuid.UUID
	SlotId uuid.UUID
}
