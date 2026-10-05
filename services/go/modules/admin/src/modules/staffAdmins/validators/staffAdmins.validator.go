package validators

import (
	"slices"
	"strings"

	"zudomart/modules/admin/src/modules/staffAdmins/dtos"
	"zudomart/modules/admin/src/utils/validation"
)

var staffRoles = []string{"ADMIN", "SUPPORT", "SUPERADMIN"}

func requireReason(collector *validation.Collector, reason string) {
	trimmed := strings.TrimSpace(reason)
	collector.RequireTrue("reason", len(trimmed) >= 5 && len(trimmed) <= 1000, "must be 5 to 1000 characters")
}

func ValidateCreateAdminRequest(request dtos.CreateAdminRequest) error {
	collector := &validation.Collector{}
	collector.RequireLength("email", request.Email, 3, 254)
	collector.RequireLength("name", request.Name, 0, 80)
	collector.RequireTrue("role", slices.Contains(staffRoles, strings.ToUpper(request.Role)), "must be ADMIN, SUPPORT or SUPERADMIN")
	collector.RequireTrue("permissions", len(request.Permissions) <= 200 && len(request.RoleIds) <= 20, "has too many entries")
	requireReason(collector, request.Reason)
	return collector.Result()
}

func ValidateChangePermissionsRequest(request dtos.ChangePermissionsRequest) error {
	collector := &validation.Collector{}
	collector.RequireTrue("role", slices.Contains(staffRoles[:2], strings.ToUpper(request.Role)), "must be ADMIN or SUPPORT")
	collector.RequireTrue("permissions", len(request.Permissions) <= 200 && len(request.RoleIds) <= 20, "has too many entries")
	requireReason(collector, request.Reason)
	return collector.Result()
}

func ValidateReasonRequest(request dtos.ReasonRequest) error {
	collector := &validation.Collector{}
	requireReason(collector, request.Reason)
	return collector.Result()
}

func ValidateCreateRoleRequest(request dtos.CreateRoleRequest) error {
	collector := &validation.Collector{}
	collector.RequireLength("name", strings.TrimSpace(request.Name), 2, 60)
	collector.RequireTrue("permissions", len(request.Permissions) >= 1 && len(request.Permissions) <= 200, "must list 1 to 200 permissions")
	requireReason(collector, request.Reason)
	return collector.Result()
}

func ValidateUpdateStaffSettingsRequest(request dtos.UpdateStaffSettingsRequest) error {
	collector := &validation.Collector{}
	collector.RequireTrue("requireSecondSuperadminApproval", request.RequireSecondSuperadminApproval != nil, "is required")
	requireReason(collector, request.Reason)
	return collector.Result()
}

func ValidateUpdateAdminRequest(request dtos.UpdateAdminRequest) error {
	collector := &validation.Collector{}
	collector.RequireTrue("ipAllowList", request.IpAllowList != nil && len(*request.IpAllowList) <= 50, "must list at most 50 entries")
	requireReason(collector, request.Reason)
	return collector.Result()
}
