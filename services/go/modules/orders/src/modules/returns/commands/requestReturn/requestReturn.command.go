package requestreturn

import (
	"github.com/google/uuid"

	"nantty/modules/orders/src/modules/returns/dtos"
)

type Command struct {
	BuyerId uuid.UUID
	OrderId uuid.UUID
	Request dtos.RequestReturnRequest
}
