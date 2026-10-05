package validators

import (
	"slices"
	"strconv"

	"zudomart/modules/catalog/src/modules/storeTeam/dtos"
	"zudomart/modules/catalog/src/utils"
	"zudomart/platform/commerceports"
)

func ValidateCreateStaff(body dtos.CreateStaffRequest) error {
	var collected utils.Issues
	utils.ParseIdentifier("userId", body.UserId, &collected)
	if body.Role != "owner" && !slices.Contains(dtos.StaffRoles, body.Role) {
		collected.Add("role", "must be manager, inventory, sales or accountant")
	}
	validateLocationIds(body.LocationIds, &collected)
	if body.Permissions != nil {
		validatePermissions(*body.Permissions, &collected)
	}
	return collected.AsError()
}

func ValidateUpdateStaff(body dtos.UpdateStaffRequest) error {
	var collected utils.Issues
	if body.Name != nil {
		collected.CheckLength("name", *body.Name, 1, 80)
	}
	if body.Role != nil && *body.Role != "owner" && !slices.Contains(dtos.StaffRoles, *body.Role) {
		collected.Add("role", "must be manager, inventory, sales or accountant")
	}
	if body.Status != nil && *body.Status != "active" && *body.Status != "suspended" {
		collected.Add("status", "must be active or suspended")
	}
	if body.LocationIds != nil {
		validateLocationIds(*body.LocationIds, &collected)
	}
	if body.Permissions.Present && body.Permissions.Values != nil {
		validatePermissions(body.Permissions.Values, &collected)
	}
	return collected.AsError()
}

func validateLocationIds(locationIds []string, collected *utils.Issues) {
	if len(locationIds) == 0 || len(locationIds) > 20 {
		collected.Add("locationIds", "must list between 1 and 20 locations")
		return
	}
	utils.ParseIdentifiers("locationIds", locationIds, collected)
}

func validatePermissions(permissions []string, collected *utils.Issues) {
	if len(permissions) > 40 {
		collected.Add("permissions", "must list at most 40 permissions")
		return
	}
	for index, permission := range permissions {
		path := "permissions." + strconv.Itoa(index)
		if !commerceports.IsKnownSellerPermission(permission) {
			collected.Add(path, "is not a known permission")
		} else if commerceports.IsOwnerOnlyPermission(permission) {
			collected.Add(path, "is reserved for the store owner")
		}
	}
}

func ValidateSearchText(text string) error {
	var collected utils.Issues
	if trimmed := len([]rune(text)); trimmed < 2 || trimmed > 60 {
		collected.Add("q", "must be between 2 and 60 characters")
	}
	return collected.AsError()
}
