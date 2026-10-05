package listsellerrefunds

import (
	"github.com/google/uuid"

	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
	"zudomart/modules/wallet/src/modules/sellerMoney/services"
)

type Query struct {
	Seller dtos.SellerContext
	Period services.DateRange
	Text   string
	After  *uuid.UUID
	Limit  int
}
