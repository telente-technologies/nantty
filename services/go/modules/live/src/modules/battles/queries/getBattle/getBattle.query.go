package getbattle

import (
	"github.com/google/uuid"
)

type Query struct {
	Viewer   uuid.UUID
	BattleId uuid.UUID
}
