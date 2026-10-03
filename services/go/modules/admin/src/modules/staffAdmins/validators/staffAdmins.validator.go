package validators

import (
	"zudomart/modules/admin/src/modules/staffAdmins/dtos"
	"zudomart/modules/admin/src/utils/validation"
)

func ValidateInviteStaffRequest(request dtos.InviteStaffRequest) error {
	collector := &validation.Collector{}
	collector.RequireLength("email", request.Email, 3, 254)
	collector.RequireLength("displayName", request.DisplayName, 0, 80)
	collector.RequireTrue("permissions", len(request.Permissions) <= 40, "has too many entries")
	return collector.Result()
}

func ValidateChangePermissionsRequest(request dtos.ChangePermissionsRequest) error {
	collector := &validation.Collector{}
	collector.RequireTrue("permissions", request.Permissions != nil && len(request.Permissions) <= 40, "must be a list of up to 40 entries")
	return collector.Result()
}
