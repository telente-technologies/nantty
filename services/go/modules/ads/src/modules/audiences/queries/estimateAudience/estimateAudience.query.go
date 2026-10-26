package estimateaudience

import (
	"github.com/google/uuid"

	"nantty/modules/ads/src/modules/audiences/dtos"
)

type Query struct {
	AccountId uuid.UUID
	UserId    uuid.UUID
	Request   dtos.EstimateRequest
}
