package setdefaultsellerpayoutaccount

import (
	"github.com/google/uuid"

	"nantty/modules/wallet/src/modules/sellerMoney/dtos"
)

type Command struct {
	Seller    dtos.SellerContext
	AccountId uuid.UUID
}
