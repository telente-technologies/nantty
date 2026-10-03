package getlivesharecard

import (
	"github.com/google/uuid"
)

type Query struct {
	LiveId   uuid.UUID
	ViewerId uuid.UUID
}
