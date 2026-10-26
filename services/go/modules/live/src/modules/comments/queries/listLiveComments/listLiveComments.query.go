package listlivecomments

import (
	"github.com/google/uuid"
	"nantty/modules/live/src/types"
)

type Query struct {
	Actor       types.Actor
	LiveId      uuid.UUID
	Cursor      string
	Limit       int
	OldestFirst bool
}
