package bulkproductaction

import (
	"nantty/modules/catalog/src/modules/sellerProducts/dtos"
	"nantty/platform/commerceports"
)

type Command struct {
	Store   commerceports.StoreAccess
	Request dtos.BulkActionRequest
}
