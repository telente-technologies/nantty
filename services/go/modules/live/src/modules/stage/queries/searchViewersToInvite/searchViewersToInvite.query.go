package searchviewerstoinvite

import (
	"nantty/modules/live/src/types"

	"github.com/google/uuid"
)

type Query struct {
	Actor  types.Actor
	LiveId uuid.UUID
	Search string
}
