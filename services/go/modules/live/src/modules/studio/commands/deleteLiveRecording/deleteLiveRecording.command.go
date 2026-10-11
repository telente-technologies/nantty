package deleteliverecording

import (
	"github.com/google/uuid"

	"zudomart/modules/live/src/types"
)

type Command struct {
	Actor       types.Actor
	LiveId      uuid.UUID
	RecordingId uuid.UUID
}
