package getstreamkey

import (
	"github.com/google/uuid"
	"zudomart/modules/live/src/interfaces"
	"zudomart/modules/live/src/types"
)

type Query struct {
	Actor    types.Actor
	LiveId   uuid.UUID
	Protocol interfaces.IngressProtocol
}
