package createstore

import (
	"github.com/google/uuid"

	"zudomart/modules/catalog/src/modules/stores/dtos"
)

type Command struct {
	AccountId uuid.UUID
	Request   dtos.CreateStoreRequest
}
