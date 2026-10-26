package listsellerrefunds

import (
	"github.com/google/uuid"

	"nantty/modules/wallet/src/modules/sellerMoney/dtos"
	"nantty/modules/wallet/src/modules/sellerMoney/services"
)

type Query struct {
	Seller dtos.SellerContext
	Period services.DateRange
	Text   string
	After  *uuid.UUID
	Limit  int
}
