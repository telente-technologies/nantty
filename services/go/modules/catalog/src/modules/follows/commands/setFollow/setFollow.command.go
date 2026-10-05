package setfollow

import "github.com/google/uuid"

const TargetBrand = "brand"

type Command struct {
	AccountId  uuid.UUID
	TargetKind string
	TargetId   uuid.UUID
	Follow     bool
}
