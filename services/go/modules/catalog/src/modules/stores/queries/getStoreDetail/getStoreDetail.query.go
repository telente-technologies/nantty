package getstoredetail

import "github.com/google/uuid"

type Query struct {
	StoreId uuid.UUID
	Viewer  *uuid.UUID
}
