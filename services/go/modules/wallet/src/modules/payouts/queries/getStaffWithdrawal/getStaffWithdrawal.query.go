package getstaffwithdrawal

import "github.com/google/uuid"

type Query struct {
	WithdrawalId uuid.UUID
}
