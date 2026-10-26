package listsellerpayouts

import (
	"github.com/google/uuid"

	"nantty/modules/wallet/src/modules/sellerMoney/dtos"
)

type Query struct {
	Seller dtos.SellerContext
	After  *uuid.UUID
	Limit  int
}
