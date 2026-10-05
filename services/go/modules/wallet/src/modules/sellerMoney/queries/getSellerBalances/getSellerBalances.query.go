package getsellerbalances

import (
	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
)

type Query struct {
	Seller dtos.SellerContext
}
