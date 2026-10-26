package getsellerfees

import (
	"nantty/modules/wallet/src/modules/sellerMoney/dtos"
	"nantty/modules/wallet/src/modules/sellerMoney/services"
)

type Query struct {
	Seller dtos.SellerContext
	Period services.DateRange
}
