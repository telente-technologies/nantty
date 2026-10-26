package resolveviewerlocale

import (
	"github.com/google/uuid"

	"nantty/modules/currency/src/modules/locale/models"
)

type Query struct {
	AccountId            uuid.UUID
	TrustedHeaderCountry string
	RemoteAddress        string
	ClientRegionHint     string
}

type Result = models.ViewerLocale
