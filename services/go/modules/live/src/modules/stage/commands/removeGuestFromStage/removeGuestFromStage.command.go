package removeguestfromstage

import (
	"nantty/modules/live/src/types"

	"github.com/google/uuid"
)

type Command struct {
	Actor       types.Actor
	LiveId      uuid.UUID
	GuestUserId uuid.UUID
	Reason      string
}
