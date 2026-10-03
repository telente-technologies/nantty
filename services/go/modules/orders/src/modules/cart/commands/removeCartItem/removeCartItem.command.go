package removecartitem

import "github.com/google/uuid"

type Command struct {
	AccountId uuid.UUID
	ItemId    uuid.UUID
}
