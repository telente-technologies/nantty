package savepromotion

import (
	"github.com/google/uuid"

	"zudomart/modules/orders/src/modules/promotions/dtos"
	"zudomart/platform/commerceports"
)

type Command struct {
	Store       commerceports.StoreAccess
	PromotionId *uuid.UUID
	Request     dtos.PromotionRequest
}
