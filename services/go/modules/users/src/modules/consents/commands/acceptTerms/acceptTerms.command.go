package acceptterms

import (
	"github.com/google/uuid"

	"nantty/modules/users/src/modules/consents/models"
)

type Command struct {
	AccountId    uuid.UUID
	TermsVersion string
	Metadata     models.RequestMetadata
}
