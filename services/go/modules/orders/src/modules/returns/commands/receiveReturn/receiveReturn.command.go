package receivereturn

import (
	"github.com/google/uuid"

	"nantty/modules/orders/src/services"
)

type Command struct {
	Seller     services.SellerContext
	ReturnId   uuid.UUID
	LocationId *uuid.UUID
}
