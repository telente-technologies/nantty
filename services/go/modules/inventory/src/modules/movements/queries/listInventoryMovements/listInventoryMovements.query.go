package listinventorymovements

import (
	"time"

	"github.com/google/uuid"
)

type Query struct {
	StoreId    uuid.UUID
	LocationId *uuid.UUID
	VariantId  *uuid.UUID
	Kind       string
	Text       string
	From       *time.Time
	To         *time.Time
	Cursor     string
	Limit      int
}
