package listbuyerstores

import "github.com/google/uuid"

type Query struct {
	BuyerId uuid.UUID
	Cursor  string
	Limit   int
}
