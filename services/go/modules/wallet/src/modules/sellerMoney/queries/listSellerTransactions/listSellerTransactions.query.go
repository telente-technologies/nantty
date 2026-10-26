package listsellertransactions

import (
	"nantty/modules/wallet/src/modules/sellerMoney/dtos"
	"nantty/modules/wallet/src/modules/sellerMoney/services"
)

type Query struct {
	Seller dtos.SellerContext
	Filter services.TransactionFilter
}
