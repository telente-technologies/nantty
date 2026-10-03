package getproductdetail

import "github.com/google/uuid"

type Query struct {
	Viewer    *uuid.UUID
	ProductId uuid.UUID
}
