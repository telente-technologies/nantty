package approvead

import (
	"github.com/google/uuid"

	"zudomart/modules/ads/src/modules/adReview/services"
)

type Command struct {
	AdId                  uuid.UUID
	Reviewer              services.Reviewer
	Reason                string
	OverrideCriticalFlags bool
}
