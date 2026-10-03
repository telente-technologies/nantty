package listsellerorders

import (
	"time"

	"github.com/google/uuid"
)

type Query struct {
	StoreId    uuid.UUID
	Status     string
	Text       string
	From       *time.Time
	To         *time.Time
	Sort       string
	Descending bool
	Cursor     string
	Limit      int
}
