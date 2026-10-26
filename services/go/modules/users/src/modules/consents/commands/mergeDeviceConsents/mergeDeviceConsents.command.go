package mergedeviceconsents

import (
	"github.com/google/uuid"

	"nantty/modules/users/src/modules/consents/models"
)

type Command struct {
	AccountId uuid.UUID
	DeviceId  string
	Metadata  models.RequestMetadata
}
