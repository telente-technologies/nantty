package listsuppliers

import "github.com/google/uuid"

type Query struct {
	StoreId uuid.UUID
	Text    string
	Cursor  string
	Limit   int
}
