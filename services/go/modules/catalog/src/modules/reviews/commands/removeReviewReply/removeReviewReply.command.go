package removereviewreply

import (
	"github.com/google/uuid"

	"nantty/platform/commerceports"
)

type Command struct {
	Store    commerceports.StoreAccess
	ReviewId uuid.UUID
}
