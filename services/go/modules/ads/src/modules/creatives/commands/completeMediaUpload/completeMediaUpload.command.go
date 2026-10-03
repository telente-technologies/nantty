package completemediaupload

import "github.com/google/uuid"

type Command struct {
	AccountId uuid.UUID
	MediaId   uuid.UUID
	UserId    uuid.UUID
}
