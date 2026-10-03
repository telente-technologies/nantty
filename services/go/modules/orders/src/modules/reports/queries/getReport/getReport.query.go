package getreport

import (
	"time"

	"zudomart/platform/commerceports"
)

type Query struct {
	Store commerceports.StoreAccess
	Kind  string
	From  time.Time
	To    time.Time
}
