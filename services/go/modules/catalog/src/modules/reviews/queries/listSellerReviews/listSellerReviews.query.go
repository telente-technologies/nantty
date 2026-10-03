package listsellerreviews

import "github.com/google/uuid"

type Query struct {
	StoreId uuid.UUID
	Kind    string
	Rating  int
	Replied string
	Text    string
	Sort    string
	Cursor  string
	Limit   int
}
