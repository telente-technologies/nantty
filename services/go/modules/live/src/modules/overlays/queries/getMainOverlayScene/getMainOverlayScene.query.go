package getmainoverlayscene

import (
	"github.com/google/uuid"
	"nantty/modules/live/src/types"
)

type Query struct {
	Actor  types.Actor
	LiveId uuid.UUID
}
