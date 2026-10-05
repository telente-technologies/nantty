package createcategory

import (
	"zudomart/modules/catalog/src/modules/adminCategories/dtos"
	"zudomart/modules/catalog/src/services"
)

type Command struct {
	Actor   services.StaffActor
	Request dtos.CreateCategoryRequest
}
