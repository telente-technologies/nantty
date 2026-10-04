package getmoderationtargetpreview

import "github.com/google/uuid"

type Query struct {
	TargetType string
	TargetId   uuid.UUID
}
