package bulkproductaction

import (
	"zudomart/modules/catalog/src/modules/sellerProducts/dtos"
	"zudomart/platform/commerceports"
)

type Command struct {
	Store   commerceports.StoreAccess
	Request dtos.BulkActionRequest
}
