package listsellersettlements

import (
	"nantty/modules/wallet/src/modules/sellerMoney/dtos"
)

type Query struct {
	Seller dtos.SellerContext
	Cursor string
	Limit  int
}
