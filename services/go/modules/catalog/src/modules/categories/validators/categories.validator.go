package validators

import (
	"zudomart/modules/catalog/src/modules/categories/dtos"
	"zudomart/modules/catalog/src/utils"
)

func ValidateCategory(body dtos.CategoryRequest) error {
	var collected utils.Issues
	collected.CheckLength("name", body.Name, 2, 40)
	if len(body.Description) > 300 {
		collected.Add("description", "must be at most 300 characters")
	}
	return collected.AsError()
}
