package getdeliverysummary

import "github.com/google/uuid"

type Query struct {
	StoreId  uuid.UUID
	Currency string
}
