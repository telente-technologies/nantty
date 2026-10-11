package listactiveorders

import "github.com/google/uuid"

type Query struct {
	BuyerId uuid.UUID
	Limit   int
}
