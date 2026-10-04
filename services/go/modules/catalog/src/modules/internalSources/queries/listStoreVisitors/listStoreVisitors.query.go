package liststorevisitors

import (
	"time"

	"github.com/google/uuid"
)

type Query struct {
	StoreId      uuid.UUID
	VisitedSince time.Time
	Cursor       string
	Limit        int
}
