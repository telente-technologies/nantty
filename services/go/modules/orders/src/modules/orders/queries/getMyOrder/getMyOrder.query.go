package getmyorder

import "github.com/google/uuid"

type Query struct {
	BuyerId uuid.UUID
	OrderId uuid.UUID
}
