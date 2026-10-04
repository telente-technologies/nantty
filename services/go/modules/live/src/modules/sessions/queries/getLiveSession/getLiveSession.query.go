package getlivesession

import (
	"github.com/google/uuid"
)

type Query struct {
	LiveId uuid.UUID
	Viewer uuid.UUID
}
