package applypresencechange

import (
	"github.com/google/uuid"
	"zudomart/modules/live/src/types"
)

type Command struct {
	LiveId uuid.UUID
	Input  types.PresenceChangeInput
}
