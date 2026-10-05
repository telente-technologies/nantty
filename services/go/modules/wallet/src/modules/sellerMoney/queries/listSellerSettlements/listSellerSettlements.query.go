package listsellersettlements

import (
	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
)

type Query struct {
	Seller dtos.SellerContext
	Cursor string
	Limit  int
}
