package listsellerpayouts

import (
	"github.com/google/uuid"

	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
)

type Query struct {
	Seller dtos.SellerContext
	After  *uuid.UUID
	Limit  int
}
