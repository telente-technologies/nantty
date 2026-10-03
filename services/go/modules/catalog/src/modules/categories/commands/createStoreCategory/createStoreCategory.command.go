package createstorecategory

import (
	"zudomart/modules/catalog/src/modules/categories/dtos"
	"zudomart/platform/commerceports"
)

type Command struct {
	Store   commerceports.StoreAccess
	Request dtos.CategoryRequest
}
