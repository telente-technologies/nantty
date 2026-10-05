package listsellertransactions

import (
	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
	"zudomart/modules/wallet/src/modules/sellerMoney/services"
)

type Query struct {
	Seller dtos.SellerContext
	Filter services.TransactionFilter
}
