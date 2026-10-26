package validators

import (
	"regexp"

	"nantty/modules/inventory/src/modules/locations/dtos"
	"nantty/modules/inventory/src/utils"
)

var phonePattern = regexp.MustCompile(`^\+?[0-9 ]{7,20}$`)

func ValidateCreateLocation(body dtos.CreateLocationRequest) error {
	var collected utils.Issues
	collected.CheckLength("name", body.Name, 2, 60)
	collected.CheckLength("address", body.Address, 5, 200)
	collected.CheckLength("city", body.City, 2, 60)
	collected.CheckLength("state", body.State, 2, 60)
	if body.Kind != "store" && body.Kind != "warehouse" {
		collected.Add("kind", "must be store or warehouse")
	}
	if body.Phone != nil && !phonePattern.MatchString(*body.Phone) {
		collected.Add("phone", "must be a valid phone number")
	}
	return collected.AsError()
}

func ValidateUpdateLocation(body dtos.UpdateLocationRequest) error {
	var collected utils.Issues
	if body.Name != nil {
		collected.CheckLength("name", *body.Name, 2, 60)
	}
	if body.Address != nil {
		collected.CheckLength("address", *body.Address, 5, 200)
	}
	if body.City != nil {
		collected.CheckLength("city", *body.City, 2, 60)
	}
	if body.State != nil {
		collected.CheckLength("state", *body.State, 2, 60)
	}
	if body.Kind != nil && *body.Kind != "store" && *body.Kind != "warehouse" {
		collected.Add("kind", "must be store or warehouse")
	}
	if body.Phone != nil && *body.Phone != "" && !phonePattern.MatchString(*body.Phone) {
		collected.Add("phone", "must be a valid phone number")
	}
	if body.IsDefault != nil && !*body.IsDefault {
		collected.Add("isDefault", "can only be set to true")
	}
	return collected.AsError()
}
