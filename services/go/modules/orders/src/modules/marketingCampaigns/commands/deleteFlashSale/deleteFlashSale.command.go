package deleteflashsale

import (
	"github.com/google/uuid"

	"zudomart/platform/commerceports"
)

type Command struct {
	Store       commerceports.StoreAccess
	FlashSaleId uuid.UUID
}
