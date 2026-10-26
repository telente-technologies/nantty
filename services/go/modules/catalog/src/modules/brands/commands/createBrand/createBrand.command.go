package createbrand

import (
	"github.com/google/uuid"

	"nantty/modules/catalog/src/modules/brands/dtos"
)

type Command struct {
	AccountId      uuid.UUID
	IdempotencyKey string
	Request        dtos.CreateBrandRequest
}
