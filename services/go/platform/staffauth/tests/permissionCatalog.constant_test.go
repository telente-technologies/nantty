package staffauth_test

import (
	. "nantty/platform/staffauth"
	"slices"
	"testing"
)

func TestEveryDepartmentTemplateOnlyUsesKnownPermissions(t *testing.T) {
	if len(DepartmentRoleTemplates) != 15 {
		t.Fatalf("expected fifteen department templates, got %d", len(DepartmentRoleTemplates))
	}
	for _, template := range DepartmentRoleTemplates {
		for _, permission := range template.Permissions {
			if !IsKnownPermission(permission) {
				t.Errorf("%s grants unknown permission %s", template.Name, permission)
			}
		}
	}
}

func TestRequestedDepartmentTemplatesAreNamedAndLeastPrivilege(t *testing.T) {
	byKey := make(map[string]DepartmentRoleTemplate, len(DepartmentRoleTemplates))
	for _, template := range DepartmentRoleTemplates {
		byKey[template.Key] = template
	}

	for key, name := range map[string]string{
		"trust_verification":   "Trust & Verification",
		"finance":              "Finance Admin",
		"moderation":           "Moderation Admin",
		"support":              "Support Agent",
		"subscription_manager": "Subscription Manager",
		"operations_analyst":   "Operations Analyst",
		"auditor":              "Auditor",
	} {
		if template, exists := byKey[key]; !exists || template.Name != name {
			t.Errorf("template %q = %+v, exists %v; want name %q", key, template, exists, name)
		}
	}

	for key, forbidden := range map[string][]string{
		"trust_verification":   {"moderation:reports", "users:suspend", "users:read-pii"},
		"moderation":           {"verification:grant", "verification:revoke", "users:read-pii"},
		"subscription_manager": {"config:read", "config:revenue", "payments:wallets", "users:read-pii"},
		"operations_analyst":   {"orders:read", "ledger:read", "audit:export", "users:read-pii"},
		"auditor":              {"audit:export", "staff:manage", "users:read-pii"},
	} {
		template := byKey[key]
		for _, permission := range forbidden {
			if slices.Contains(template.Permissions, permission) {
				t.Errorf("template %q unexpectedly grants %q", key, permission)
			}
		}
	}
	operations := byKey["operations_analyst"].Permissions
	if len(operations) != 3 || !slices.Contains(operations, "metrics:read") || !slices.Contains(operations, "logistics:read") || !slices.Contains(operations, "events:read") {
		t.Fatalf("Operations Analyst permissions = %v; want metrics:read, logistics:read, and events:read", operations)
	}
}

func TestLogisticsReadIsKnownAndGrantable(t *testing.T) {
	if !IsKnownPermission("logistics:read") || !IsGrantablePermission("logistics:read") {
		t.Fatal("logistics:read must be a known, grantable staff permission")
	}
}

func TestEventOperationsReadIsKnownAndGrantable(t *testing.T) {
	if !IsKnownPermission("events:read") || !IsGrantablePermission("events:read") {
		t.Fatal("events:read must be a known, grantable staff permission")
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
		{"plan editors manage monetization tables", []string{"config:plans"}, []string{"money.monetization.manage"}, []string{"money.ledger.read"}},
		{"config readers only read monetization tables", []string{"config:read"}, []string{"money.monetization.read"}, []string{"money.monetization.manage"}},
		{"payments wallets reaches provider reconciliation", []string{"payments:wallets"}, []string{"money.ledger.reconcile"}, []string{"money.ledger.reverse"}},
		{"creator reviewers manage creator violations", []string{"applications:creators"}, []string{"money.creators.manage"}, []string{"money.ledger.reconcile"}},
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
