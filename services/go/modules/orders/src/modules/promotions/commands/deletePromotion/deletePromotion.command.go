package deletepromotion

import (
	"github.com/google/uuid"

	"zudomart/platform/commerceports"
)

type Command struct {
	Store       commerceports.StoreAccess
	PromotionId uuid.UUID
}
