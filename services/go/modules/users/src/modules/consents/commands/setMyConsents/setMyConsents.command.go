package setmyconsents

import (
	"github.com/google/uuid"

	"nantty/modules/users/src/modules/consents/models"
)

type Command struct {
	AccountId     uuid.UUID
	Decisions     []models.Decision
	PolicyVersion string
	Metadata      models.RequestMetadata
}
