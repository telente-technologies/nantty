package decidestagejoinrequest

import (
	"nantty/modules/live/src/types"

	"github.com/google/uuid"
)

type Command struct {
	Actor     types.Actor
	LiveId    uuid.UUID
	RequestId uuid.UUID
	Approve   bool
}
