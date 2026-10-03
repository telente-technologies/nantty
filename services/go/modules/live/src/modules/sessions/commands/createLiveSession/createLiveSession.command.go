package createlivesession

import (
	"zudomart/modules/live/src/types"
)

type Command struct {
	Actor types.Actor
	Input types.CreateLiveSessionInput
}
