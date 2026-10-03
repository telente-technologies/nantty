package getaccountstatement

import "github.com/google/uuid"

type Query struct {
	AccountCode string
	Currency    string
	AfterLineId *uuid.UUID
	Limit       int
}
