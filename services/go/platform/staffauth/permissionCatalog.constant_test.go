package staffauth

import (
	"slices"
	"testing"
)

func TestEveryDepartmentTemplateOnlyUsesKnownPermissions(t *testing.T) {
	if len(DepartmentRoleTemplates) != 10 {
		t.Fatalf("expected ten department templates, got %d", len(DepartmentRoleTemplates))
	}
	for _, template := range DepartmentRoleTemplates {
		for _, permission := range template.Permissions {
			if !IsKnownPermission(permission) {
				t.Errorf("%s grants unknown permission %s", template.Name, permission)
			}
		}
	}
}

func TestPermissionAliasesBridgeContractKeysToServiceKeys(t *testing.T) {
	cases := []struct {
		name     string
		granted  []string
		expected []string
		absent   []string
	}{
		{"audit read opens the audit routes", []string{"audit:read"}, []string{"audit:read", "admin.audit.read"}, []string{"admin.config.write"}},
		{"finance reaches the ledger and payouts", []string{"ledger:read", "payouts:approve"}, []string{"money.ledger.read", "money.withdrawals.process"}, []string{"money.ledger.reverse"}},
		{"usernames manage opens the withhold tools", []string{"usernames:manage"}, []string{"users.usernames.withhold"}, []string{"users.usernames.reserve"}},
		{"nothing granted nothing aliased", nil, nil, []string{"admin.audit.read"}},
	}
	for _, testCase := range cases {
		expanded := ExpandPermissionsWithAliases(testCase.granted)
		for _, wanted := range testCase.expected {
			if !slices.Contains(expanded, wanted) {
				t.Errorf("%s: missing %s in %v", testCase.name, wanted, expanded)
			}
		}
		for _, unwanted := range testCase.absent {
			if slices.Contains(expanded, unwanted) {
				t.Errorf("%s: unexpected %s", testCase.name, unwanted)
			}
		}
	}
}

func TestSuperadminHoldsEveryPermissionAndAdminsOnlyTheirOwn(t *testing.T) {
	superadmin := Staff{Role: SuperadminRole}
	admin := Staff{Role: AdminRole, Permissions: []string{"users:read"}}
	for _, permission := range AllPermissionKeys {
		if !superadmin.Can(permission) {
			t.Fatalf("superadmin must hold %s", permission)
		}
	}
	if !admin.Can("users:read") || admin.Can("users:ban") || !admin.CanAny("users:ban", "users:read") || admin.CanAny() {
		t.Fatal("admins hold exactly their own permissions")
	}
}
