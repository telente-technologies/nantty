package listproducts

import "github.com/google/uuid"

type Query struct {
	Viewer     *uuid.UUID
	CategoryId *uuid.UUID
	StoreId    *uuid.UUID
	Collection string
	Text       string
	Featured   bool
	Cursor     string
	Limit      int
}
