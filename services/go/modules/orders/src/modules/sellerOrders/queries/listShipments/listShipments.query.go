package listshipments

import "github.com/google/uuid"

type Query struct {
	StoreId uuid.UUID
	Status  string
	Text    string
	Cursor  string
	Limit   int
}
