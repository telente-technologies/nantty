package getsellerorder

import "github.com/google/uuid"

type Query struct {
	StoreId uuid.UUID
	OrderId uuid.UUID
}
