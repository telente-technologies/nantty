package getreport

import (
	"time"

	"github.com/google/uuid"

	"nantty/platform/commerceports"
)

type Query struct {
	Store      commerceports.StoreAccess
	ActorId    uuid.UUID
	Kind       string
	From       time.Time
	To         time.Time
	LocationId *uuid.UUID
}
