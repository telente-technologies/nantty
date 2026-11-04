package services

import "testing"

func TestScheduledReportManagementIsNotGrantedToReadOnlyRoles(t *testing.T) {
	if !RoleHasPermission("analyst", PermissionReportsView) {
		t.Fatal("analysts should retain read-only report access")
	}
	if RoleHasPermission("analyst", PermissionReportsManage) {
		t.Fatal("analysts must not create or delete scheduled reports")
	}
	if RoleHasPermission("billing", PermissionReportsManage) {
		t.Fatal("billing role must not manage scheduled reports")
	}
	if !RoleHasPermission("admin", PermissionReportsManage) {
		t.Fatal("ad account admins should manage scheduled reports")
	}
}
