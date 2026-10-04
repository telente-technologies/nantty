package listflashsales

import "github.com/google/uuid"

type Query struct {
	StoreId uuid.UUID
	Status  string
	Cursor  string
	Limit   int
}
