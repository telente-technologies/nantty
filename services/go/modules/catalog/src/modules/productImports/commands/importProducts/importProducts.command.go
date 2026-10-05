package importproducts

import (
	"zudomart/modules/catalog/src/modules/productImports/dtos"
	"zudomart/modules/catalog/src/services"
	"zudomart/platform/commerceports"
)

type Command struct {
	Store          commerceports.StoreAccess
	Actor          services.StoreActor
	IdempotencyKey string
	Request        dtos.ImportRequest
}
