package recordmediaprocessed

import (
	"github.com/google/uuid"

	"nantty/modules/ads/src/modules/creatives/dtos"
)

type Command struct {
	MediaId uuid.UUID
	Request dtos.MediaProcessedRequest
}
