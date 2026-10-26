package reportguestmediaconnection

import (
	"nantty/modules/live/src/types"

	"github.com/google/uuid"
)

type Command struct {
	Actor     types.Actor
	LiveId    uuid.UUID
	Connected bool
}
