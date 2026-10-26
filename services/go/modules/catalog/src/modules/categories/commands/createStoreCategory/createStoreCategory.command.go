package createstorecategory

import (
	"nantty/modules/catalog/src/modules/categories/dtos"
	"nantty/platform/commerceports"
)

type Command struct {
	Store   commerceports.StoreAccess
	Request dtos.CategoryRequest
}
