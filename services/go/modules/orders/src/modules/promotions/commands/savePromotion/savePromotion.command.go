package savepromotion

import (
	"github.com/google/uuid"

	"nantty/modules/orders/src/modules/promotions/dtos"
	"nantty/platform/commerceports"
)

type Command struct {
	Store       commerceports.StoreAccess
	PromotionId *uuid.UUID
	Request     dtos.PromotionRequest
}
