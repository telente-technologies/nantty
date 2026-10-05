package reversecointransaction

import "github.com/google/uuid"

type Command struct {
	StaffId        string
	TransactionId  uuid.UUID
	Reason         string
	IdempotencyKey string
}
