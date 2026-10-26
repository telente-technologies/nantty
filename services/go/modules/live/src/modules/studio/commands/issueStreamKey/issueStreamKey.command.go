package issuestreamkey

import (
	"github.com/google/uuid"
	"nantty/modules/live/src/interfaces"
	"nantty/modules/live/src/types"
)

type Command struct {
	Actor    types.Actor
	LiveId   uuid.UUID
	Protocol interfaces.IngressProtocol
}
