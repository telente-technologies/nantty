package updateoverlayscene

import (
	"github.com/google/uuid"
	"nantty/modules/live/src/types"
)

type Command struct {
	Actor   types.Actor
	LiveId  uuid.UUID
	SceneId string
	Input   types.OverlaySceneInput
}
