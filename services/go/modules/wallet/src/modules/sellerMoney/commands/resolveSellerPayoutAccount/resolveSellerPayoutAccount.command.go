package resolvesellerpayoutaccount

import (
	"nantty/modules/wallet/src/modules/sellerMoney/dtos"
)

type Command struct {
	Seller dtos.SellerContext
	Body   dtos.ResolvePayoutAccountBody
}
