package uploadcustomerlist

import (
	"github.com/google/uuid"

	"zudomart/modules/ads/src/modules/audiences/dtos"
)

type Command struct {
	AccountId      uuid.UUID
	UserId         uuid.UUID
	IdempotencyKey string
	Request        dtos.CustomerListRequest
}
