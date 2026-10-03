package cancelmyorder

import "github.com/google/uuid"

type Command struct {
	BuyerId uuid.UUID
	OrderId uuid.UUID
	Reason  string
}
