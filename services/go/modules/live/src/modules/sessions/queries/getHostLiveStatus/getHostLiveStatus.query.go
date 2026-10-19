package gethostlivestatus

import (
	"github.com/google/uuid"
)

type Query struct {
	HostId uuid.UUID
	Viewer uuid.UUID
}
