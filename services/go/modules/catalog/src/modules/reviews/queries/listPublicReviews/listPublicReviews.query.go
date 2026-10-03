package listpublicreviews

import "github.com/google/uuid"

type Query struct {
	ProductId *uuid.UUID
	StoreId   *uuid.UUID
	Cursor    string
	Limit     int
}
