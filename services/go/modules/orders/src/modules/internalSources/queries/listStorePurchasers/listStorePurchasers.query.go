package liststorepurchasers

import (
	"time"

	"github.com/google/uuid"
)

type Query struct {
	StoreId       uuid.UUID
	PurchasedFrom time.Time
	MinimumOrders int
	Cursor        string
	Limit         int
}
