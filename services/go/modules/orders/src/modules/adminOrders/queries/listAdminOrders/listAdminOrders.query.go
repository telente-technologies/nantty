package listadminorders

import "github.com/google/uuid"

type Query struct {
	Status   string
	Currency string
	StoreId  *uuid.UUID
	Text     string
	Cursor   string
	Limit    int
}
