package pinlivecomment

import (
	"github.com/google/uuid"
	"nantty/modules/live/src/types"
)

type Command struct {
	Actor     types.Actor
	LiveId    uuid.UUID
	CommentId uuid.UUID
}
