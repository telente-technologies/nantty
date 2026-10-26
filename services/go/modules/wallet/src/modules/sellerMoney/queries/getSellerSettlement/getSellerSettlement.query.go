package getsellersettlement

import "nantty/modules/wallet/src/modules/sellerMoney/dtos"

type Query struct {
	Seller       dtos.SellerContext
	SettlementId string
}
