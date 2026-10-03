package liststockadjustments

import "github.com/google/uuid"

type Query struct {
	StoreId    uuid.UUID
	LocationId *uuid.UUID
	Reason     string
	Text       string
	Cursor     string
	Limit      int
}
