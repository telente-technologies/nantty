package markcointransactionreviewed

import "github.com/google/uuid"

type Command struct {
	StaffId       string
	TransactionId uuid.UUID
	Note          string
}
