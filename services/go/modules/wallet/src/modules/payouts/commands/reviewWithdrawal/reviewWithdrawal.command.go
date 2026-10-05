package reviewwithdrawal

import "github.com/google/uuid"

type Command struct {
	StaffId        string
	WithdrawalId   uuid.UUID
	Decision       string
	Reason         string
	IdempotencyKey string
}
