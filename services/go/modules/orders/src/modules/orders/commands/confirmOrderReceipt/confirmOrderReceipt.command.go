package confirmorderreceipt

import "github.com/google/uuid"

type Command struct {
	BuyerId uuid.UUID
	OrderId uuid.UUID
}
