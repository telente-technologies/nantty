package applytopupresult

import (
	"time"

	"github.com/google/uuid"
)

type Command struct {
	AccountId   uuid.UUID
	TopUpId     string
	AmountMinor int64
	Currency    string
	OccurredAt  time.Time
}
