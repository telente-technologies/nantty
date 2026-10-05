package createconversionevent

import (
	"github.com/google/uuid"

	"zudomart/modules/ads/src/modules/tools/dtos"
)

type Command struct {
	AccountId uuid.UUID
	UserId    uuid.UUID
	Input     dtos.ConversionEventInput
}
