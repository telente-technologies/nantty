package updatereorderlevels

import (
	"github.com/google/uuid"

	"nantty/platform/commerceports"
)

type Command struct {
	Store           commerceports.StoreAccess
	VariantId       uuid.UUID
	ReorderPoint    int
	ReorderQuantity int
}
