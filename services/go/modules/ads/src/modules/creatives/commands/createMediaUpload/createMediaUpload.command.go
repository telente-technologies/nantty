package createmediaupload

import (
	"github.com/google/uuid"

	"nantty/modules/ads/src/modules/creatives/dtos"
)

type Command struct {
	AccountId uuid.UUID
	UserId    uuid.UUID
	Request   dtos.CreateMediaUploadRequest
}
