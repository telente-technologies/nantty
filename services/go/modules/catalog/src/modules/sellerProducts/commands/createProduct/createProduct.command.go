package createproduct

import (
	"github.com/google/uuid"

	"nantty/modules/catalog/src/modules/sellerProducts/dtos"
	"nantty/platform/commerceports"
)

type Command struct {
	Store   commerceports.StoreAccess
	ActorId uuid.UUID
	Request dtos.ProductUpsertRequest
}
