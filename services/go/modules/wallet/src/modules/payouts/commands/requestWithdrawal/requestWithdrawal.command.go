package requestwithdrawal

import "github.com/google/uuid"

type Command struct {
	UserId          string
	PayoutAccountId uuid.UUID
	AmountMinor     int64
	Currency        string
	IdempotencyKey  string
}
