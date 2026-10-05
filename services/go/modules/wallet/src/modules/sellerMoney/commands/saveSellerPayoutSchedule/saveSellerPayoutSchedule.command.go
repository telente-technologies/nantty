package savesellerpayoutschedule

import (
	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
)

type Command struct {
	Seller dtos.SellerContext
	Body   dtos.SavePayoutScheduleBody
}
