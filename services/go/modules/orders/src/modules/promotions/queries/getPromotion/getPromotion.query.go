package getpromotion

import (
	"github.com/google/uuid"

	"zudomart/platform/commerceports"
)

type Query struct {
	Store       commerceports.StoreAccess
	PromotionId uuid.UUID
}
