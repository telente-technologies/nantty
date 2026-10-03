package listmyorders

import "github.com/google/uuid"

type Query struct {
	BuyerId uuid.UUID
	Status  string
	Cursor  string
	Limit   int
}
