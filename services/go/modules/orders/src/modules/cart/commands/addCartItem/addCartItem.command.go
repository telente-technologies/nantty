package addcartitem

import (
	"github.com/google/uuid"

	"zudomart/modules/orders/src/modules/cart/dtos"
)

type Command struct {
	AccountId uuid.UUID
	Request   dtos.AddCartItemRequest
}
