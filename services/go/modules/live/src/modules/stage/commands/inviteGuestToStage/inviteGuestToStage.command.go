package inviteguesttostage

import (
	"nantty/modules/live/src/types"

	"github.com/google/uuid"
)

type Command struct {
	Actor       types.Actor
	LiveId      uuid.UUID
	GuestUserId uuid.UUID
	StageRole   string
	StageTitle  string
}
