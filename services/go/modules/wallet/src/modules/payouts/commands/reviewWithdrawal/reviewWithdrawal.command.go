package reviewwithdrawal

import "github.com/google/uuid"

type Command struct {
	StaffId        string
	WithdrawalId   uuid.UUID
	Approve        bool
	Reason         string
	IdempotencyKey string
}
