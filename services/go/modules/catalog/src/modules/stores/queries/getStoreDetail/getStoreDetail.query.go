package getstoredetail

import "github.com/google/uuid"

type Query struct {
	StoreId uuid.UUID
	Slug    string
	Viewer  *uuid.UUID
}
