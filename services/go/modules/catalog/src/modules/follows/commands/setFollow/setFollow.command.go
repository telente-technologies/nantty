package setfollow

import "github.com/google/uuid"

const (
	TargetStore = "store"
	TargetBrand = "brand"
)

type Command struct {
	AccountId  uuid.UUID
	TargetKind string
	TargetId   uuid.UUID
	Follow     bool
}
