package updatecategory

import (
	"github.com/google/uuid"

	"zudomart/modules/catalog/src/modules/adminCategories/dtos"
	"zudomart/modules/catalog/src/services"
)

type Command struct {
	Actor      services.StaffActor
	CategoryId uuid.UUID
	Request    dtos.UpdateCategoryRequest
}
