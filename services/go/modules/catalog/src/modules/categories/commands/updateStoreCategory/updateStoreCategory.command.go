package updatestorecategory

import (
	"github.com/google/uuid"

	"zudomart/modules/catalog/src/modules/categories/dtos"
	"zudomart/platform/commerceports"
)

type Command struct {
	Store      commerceports.StoreAccess
	CategoryId uuid.UUID
	Request    dtos.CategoryRequest
}
