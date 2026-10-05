package listauditlog

import (
	"time"

	"zudomart/platform/commerceports"
)

type Query struct {
	Store        commerceports.StoreAccess
	ActorId      string
	ActionPrefix string
	From         *time.Time
	Until        *time.Time
	Cursor       string
	Limit        int
}
