package requestreportexport

import (
	"time"

	"github.com/google/uuid"

	"nantty/platform/commerceports"
)

type Command struct {
	Store   commerceports.StoreAccess
	ActorId uuid.UUID
	Kind    string
	From    time.Time
	To      time.Time
}
