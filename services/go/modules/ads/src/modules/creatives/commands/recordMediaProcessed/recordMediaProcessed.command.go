package recordmediaprocessed

import (
	"github.com/google/uuid"

	"zudomart/modules/ads/src/modules/creatives/dtos"
)

type Command struct {
	MediaId uuid.UUID
	Request dtos.MediaProcessedRequest
}
