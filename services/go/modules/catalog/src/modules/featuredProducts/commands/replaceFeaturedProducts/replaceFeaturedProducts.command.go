package replacefeaturedproducts

import (
	"nantty/modules/catalog/src/modules/featuredProducts/dtos"
	"nantty/platform/commerceports"
)

type Command struct {
	Store   commerceports.StoreAccess
	Request dtos.ReplaceFeaturedProductsRequest
}
