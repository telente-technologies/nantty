package createcategory

import (
	"nantty/modules/catalog/src/modules/adminCategories/dtos"
	"nantty/modules/catalog/src/services"
)

type Command struct {
	Actor   services.StaffActor
	Request dtos.CreateCategoryRequest
}
