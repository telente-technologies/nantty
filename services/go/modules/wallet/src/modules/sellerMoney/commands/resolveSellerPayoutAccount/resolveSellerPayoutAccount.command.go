package resolvesellerpayoutaccount

import (
	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
)

type Command struct {
	Seller dtos.SellerContext
	Body   dtos.ResolvePayoutAccountBody
}
