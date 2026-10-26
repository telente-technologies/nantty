package pinproducttolive

import (
	"nantty/modules/live/src/types"

	"github.com/google/uuid"
)

type Command struct {
	Actor     types.Actor
	LiveId    uuid.UUID
	ProductId uuid.UUID
}
