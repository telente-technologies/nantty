package getsellerproduct

import "github.com/google/uuid"

type Query struct {
	StoreId   uuid.UUID
	ProductId uuid.UUID
}
