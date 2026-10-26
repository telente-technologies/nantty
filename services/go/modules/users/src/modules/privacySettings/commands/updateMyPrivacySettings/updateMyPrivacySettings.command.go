package updatemyprivacysettings

import (
	"github.com/google/uuid"

	consentmodels "nantty/modules/users/src/modules/consents/models"
)

type Command struct {
	AccountId       uuid.UUID
	Personalization *bool
	PersonalizedAds *bool
	Marketing       *bool
	Analytics       *bool
	PolicyVersion   string
	Metadata        consentmodels.RequestMetadata
}
