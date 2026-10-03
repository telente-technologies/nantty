package getliveleaderboard

import (
	"github.com/google/uuid"
)

type Query struct {
	LiveId   uuid.UUID
	Viewer   uuid.UUID
	Receiver *uuid.UUID
	Limit    int
}
