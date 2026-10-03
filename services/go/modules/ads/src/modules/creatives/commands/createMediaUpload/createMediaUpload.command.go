package createmediaupload

import (
	"github.com/google/uuid"

	"zudomart/modules/ads/src/modules/creatives/dtos"
)

type Command struct {
	AccountId uuid.UUID
	UserId    uuid.UUID
	Request   dtos.CreateMediaUploadRequest
}
