package listreportexports

import "github.com/google/uuid"

type Query struct {
	StoreId uuid.UUID
	Cursor  string
	Limit   int
}
