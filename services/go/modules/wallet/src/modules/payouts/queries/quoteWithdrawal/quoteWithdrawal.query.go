package quotewithdrawal

import "github.com/google/uuid"

type Query struct {
	UserId          string
	PayoutAccountId uuid.UUID
	AmountMinor     int64
	Currency        string
}
