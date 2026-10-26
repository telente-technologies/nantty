package listmylives

import (
	"nantty/modules/live/src/types"
)

type Query struct {
	Actor  types.Actor
	Cursor string
	Limit  int
}
