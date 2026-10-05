package addsellerpayoutaccount

import (
	"github.com/google/uuid"

	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
)

type Command struct {
	Seller       dtos.SellerContext
	ResolutionId uuid.UUID
}
