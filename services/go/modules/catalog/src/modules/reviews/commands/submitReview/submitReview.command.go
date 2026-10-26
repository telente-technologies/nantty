package submitreview

import (
	"github.com/google/uuid"

	"nantty/modules/catalog/src/modules/reviews/dtos"
)

type Command struct {
	AccountId uuid.UUID
	ProductId *uuid.UUID
	StoreId   *uuid.UUID
	Request   dtos.SubmitReviewRequest
}
