package updateconversionevent

import (
	"github.com/google/uuid"

	"zudomart/modules/ads/src/modules/tools/dtos"
)

type Command struct {
	AccountId uuid.UUID
	UserId    uuid.UUID
	EventId   string
	Patch     dtos.ConversionEventPatch
}
