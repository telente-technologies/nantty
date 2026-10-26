package submitapplication

import (
	"github.com/google/uuid"

	"nantty/modules/catalog/src/modules/sellerApplications/dtos"
)

type Command struct {
	AccountId      uuid.UUID
	IdempotencyKey string
	Request        dtos.SubmitApplicationRequest
}
