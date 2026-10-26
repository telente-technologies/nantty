package deleteproductbundle

import (
	"github.com/google/uuid"

	"nantty/platform/commerceports"
)

type Command struct {
	Store    commerceports.StoreAccess
	BundleId uuid.UUID
}
