package requestsellerpayout

import "nantty/modules/wallet/src/modules/sellerMoney/dtos"

type Command struct {
	Seller         dtos.SellerContext
	Body           dtos.RequestPayoutBody
	IdempotencyKey string
}
