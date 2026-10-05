package getsellerstatement

import (
	"time"

	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
)

type Query struct {
	Seller dtos.SellerContext
	Month  time.Time
}
