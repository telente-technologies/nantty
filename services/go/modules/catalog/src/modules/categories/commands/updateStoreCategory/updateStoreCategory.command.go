package updatestorecategory

import (
	"github.com/google/uuid"

	"nantty/modules/catalog/src/modules/categories/dtos"
	"nantty/platform/commerceports"
)

type Command struct {
	Store      commerceports.StoreAccess
	CategoryId uuid.UUID
	Request    dtos.CategoryRequest
}
