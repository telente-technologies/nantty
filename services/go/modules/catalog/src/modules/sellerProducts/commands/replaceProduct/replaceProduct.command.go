package replaceproduct

import (
	"github.com/google/uuid"

	"zudomart/modules/catalog/src/modules/sellerProducts/dtos"
	"zudomart/platform/commerceports"
)

type Command struct {
	Store     commerceports.StoreAccess
	ActorId   uuid.UUID
	ProductId uuid.UUID
	Request   dtos.ProductUpsertRequest
}
