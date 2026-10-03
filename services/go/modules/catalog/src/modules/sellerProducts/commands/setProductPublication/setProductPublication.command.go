package setproductpublication

import (
	"github.com/google/uuid"

	"zudomart/platform/commerceports"
)

type Command struct {
	Store     commerceports.StoreAccess
	ProductId uuid.UUID
	Publish   bool
}
