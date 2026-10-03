package getproductusage

import "github.com/google/uuid"

type Query struct {
	StoreId        uuid.UUID
	OwnerAccountId uuid.UUID
}
