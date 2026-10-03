package listsellerproducts

import "github.com/google/uuid"

type Query struct {
	StoreId    uuid.UUID
	Text       string
	CategoryId *uuid.UUID
	VariantId  *uuid.UUID
	Status     string
	Online     string
	Visibility string
	SupplierId *uuid.UUID
	Sort       string
	Cursor     string
	Limit      int
}
