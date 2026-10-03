package cancelwithdrawal

import "github.com/google/uuid"

type Command struct {
	UserId       string
	WithdrawalId uuid.UUID
}
