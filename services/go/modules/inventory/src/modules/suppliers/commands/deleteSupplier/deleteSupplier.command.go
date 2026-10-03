package deletesupplier

import (
	"github.com/google/uuid"

	"zudomart/platform/commerceports"
)

type Command struct {
	Store      commerceports.StoreAccess
	SupplierId uuid.UUID
}
