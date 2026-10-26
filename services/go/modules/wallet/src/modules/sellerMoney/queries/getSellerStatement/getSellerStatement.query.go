package getsellerstatement

import (
	"time"

	"nantty/modules/wallet/src/modules/sellerMoney/dtos"
)

type Query struct {
	Seller dtos.SellerContext
	Month  time.Time
}
