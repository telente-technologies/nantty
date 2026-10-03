package requestreportexport

import (
	"time"

	"github.com/google/uuid"

	"zudomart/platform/commerceports"
)

type Command struct {
	Store   commerceports.StoreAccess
	ActorId uuid.UUID
	Kind    string
	From    time.Time
	To      time.Time
}
