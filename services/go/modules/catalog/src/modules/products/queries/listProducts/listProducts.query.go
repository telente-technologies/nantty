package listproducts

import "github.com/google/uuid"

type Query struct {
	Viewer       *uuid.UUID
	CategoryId   *uuid.UUID
	CategorySlug string
	StoreId      *uuid.UUID
	BrandId      *uuid.UUID
	Collection   string
	Text         string
	Featured     bool
	Sort         string
	MinPrice     *int64
	MaxPrice     *int64
	Currency     string
	Cursor       string
	Limit        int
}
