package updatepolicycategory

import (
	"github.com/google/uuid"

	"nantty/modules/ads/src/modules/adReview/dtos"
)

type Command struct {
	CategoryId uuid.UUID
	Request    dtos.PolicyCategoryRequest
}
