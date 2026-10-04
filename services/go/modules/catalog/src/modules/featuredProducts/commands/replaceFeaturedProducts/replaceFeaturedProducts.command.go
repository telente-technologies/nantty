package replacefeaturedproducts

import (
	"zudomart/modules/catalog/src/modules/featuredProducts/dtos"
	"zudomart/platform/commerceports"
)

type Command struct {
	Store   commerceports.StoreAccess
	Request dtos.ReplaceFeaturedProductsRequest
}
