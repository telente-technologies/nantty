package listsellerescrow

import (
	"github.com/google/uuid"

	"nantty/modules/wallet/src/modules/sellerMoney/dtos"
)

type Query struct {
	Seller dtos.SellerContext
	Status string
	Text   string
	After  *uuid.UUID
	Limit  int
}
