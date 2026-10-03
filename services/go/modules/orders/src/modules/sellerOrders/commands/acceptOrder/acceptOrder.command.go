package acceptorder

import (
	"github.com/google/uuid"

	"zudomart/modules/orders/src/services"
)

type Command struct {
	Seller  services.SellerContext
	OrderId uuid.UUID
}
