package deletepromotion

import (
	"github.com/google/uuid"

	"nantty/platform/commerceports"
)

type Command struct {
	Store       commerceports.StoreAccess
	PromotionId uuid.UUID
}
