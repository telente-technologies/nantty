package recorddeliveryattempt

import (
	"github.com/google/uuid"

	"nantty/modules/orders/src/services"
)

type Command struct {
	Seller  services.SellerContext
	OrderId uuid.UUID
	Outcome string
	Note    string
}
