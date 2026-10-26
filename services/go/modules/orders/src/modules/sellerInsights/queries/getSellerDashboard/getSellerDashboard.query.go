package getsellerdashboard

import (
	"github.com/google/uuid"

	"nantty/platform/commerceports"
)

type Query struct {
	Store      commerceports.StoreAccess
	ActorId    uuid.UUID
	LocationId *uuid.UUID
	Period     string
}
