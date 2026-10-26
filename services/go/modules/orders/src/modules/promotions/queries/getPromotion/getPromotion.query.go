package getpromotion

import (
	"github.com/google/uuid"

	"nantty/platform/commerceports"
)

type Query struct {
	Store       commerceports.StoreAccess
	PromotionId uuid.UUID
}
