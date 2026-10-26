package mutestagestreamer

import (
	"nantty/modules/live/src/types"

	"github.com/google/uuid"
)

type Command struct {
	Actor        types.Actor
	LiveId       uuid.UUID
	TargetUserId uuid.UUID
	Input        types.MuteGuestInput
}
