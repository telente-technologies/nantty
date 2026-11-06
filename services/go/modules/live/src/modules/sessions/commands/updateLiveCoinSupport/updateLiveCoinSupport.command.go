package updatelivecoinsupport

import (
	"github.com/google/uuid"
	"nantty/modules/live/src/types"
)

type Command struct {
	Actor   types.Actor
	LiveId  uuid.UUID
	Enabled bool
}
