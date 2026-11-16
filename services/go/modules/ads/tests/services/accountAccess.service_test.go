package services_test

import (
	"testing"

	"nantty/modules/ads/src/services"
)

func TestScheduledReportManagementIsNotGrantedToReadOnlyRoles(t *testing.T) {
	if !services.RoleHasPermission("analyst", services.PermissionReportsView) {
		t.Fatal("analysts should retain read-only report access")
	}
	if services.RoleHasPermission("analyst", services.PermissionReportsManage) {
		t.Fatal("analysts must not create or delete scheduled reports")
	}
	if services.RoleHasPermission("billing", services.PermissionReportsManage) {
		t.Fatal("billing role must not manage scheduled reports")
	}
	if !services.RoleHasPermission("admin", services.PermissionReportsManage) {
		t.Fatal("ad account admins should manage scheduled reports")
	}
}
