package importproducts

import (
	"nantty/modules/catalog/src/modules/productImports/dtos"
	"nantty/modules/catalog/src/services"
	"nantty/platform/commerceports"
)

type Command struct {
	Store          commerceports.StoreAccess
	Actor          services.StoreActor
	IdempotencyKey string
	Request        dtos.ImportRequest
}
