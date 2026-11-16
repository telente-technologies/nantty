package developerorganizations_test

import (
	"reflect"
	"testing"

	"nantty/modules/auth/src/modules/developerOrganizations"
)

func TestCapabilitiesForRole(t *testing.T) {
	tests := []struct {
		role         string
		organization []string
		application  []string
	}{
		{"owner", []string{"organization.read", "organization.manage", "members.manage", "billing.read", "billing.manage", "security.manage"}, []string{"applications.manage", "credentials.manage", "webhooks.manage", "request_logs.read", "usage.read"}},
		{"admin", []string{"organization.read", "organization.manage", "members.manage"}, []string{"applications.manage", "credentials.manage", "webhooks.manage", "request_logs.read", "usage.read"}},
		{"developer", []string{"organization.read"}, []string{"applications.read", "credentials.manage", "webhooks.manage", "request_logs.read", "usage.read"}},
		{"analyst", []string{"organization.read"}, []string{"request_logs.read", "usage.read"}},
		{"billing", []string{"organization.read", "billing.read", "billing.manage"}, []string{}},
		{"unknown", []string{}, []string{}},
	}
	for _, test := range tests {
		t.Run(test.role, func(t *testing.T) {
			organization, application := developerorganizations.CapabilitiesForRole(test.role)
			if !reflect.DeepEqual(organization, test.organization) || !reflect.DeepEqual(application, test.application) {
				t.Fatalf("CapabilitiesForRole(%q) = %v %v", test.role, organization, application)
			}
		})
	}
}

func TestApplicationCapabilitiesRequireBothRoleAndApplicationGrant(t *testing.T) {
	if developerorganizations.AllowsApplicationCapability("developer", "credentials.manage", false) {
		t.Fatal("developer without an application grant was allowed")
	}
	if !developerorganizations.AllowsApplicationCapability("developer", "credentials.manage", true) {
		t.Fatal("developer with an application grant was denied")
	}
	if developerorganizations.AllowsApplicationCapability("analyst", "credentials.manage", true) {
		t.Fatal("analyst was granted credential management")
	}
	if !developerorganizations.AllowsOrganizationCapability("billing", "billing.manage") {
		t.Fatal("billing role was denied billing management")
	}
	if !developerorganizations.AllowsOrganizationCapability("owner", "security.manage") {
		t.Fatal("owner was denied organization audit access")
	}
	if developerorganizations.AllowsOrganizationCapability("admin", "security.manage") || developerorganizations.AllowsOrganizationCapability("analyst", "security.manage") {
		t.Fatal("non-owner role was granted organization audit access")
	}
	if developerorganizations.AllowsOrganizationCapability("admin", "billing.manage") {
		t.Fatal("admin was granted billing management")
	}
	if developerorganizations.AllowsOrganizationCapability("unknown", "organization.read") {
		t.Fatal("unknown role was granted access")
	}
}

func TestApplicationAccessSeparatesEligibleCapabilitiesFromActiveGrants(t *testing.T) {
	active, eligible := developerorganizations.ApplicationCapabilitiesForGrant("developer", nil)
	if len(active) != 0 || !reflect.DeepEqual(eligible, []string{"applications.read", "credentials.manage", "webhooks.manage", "request_logs.read", "usage.read"}) {
		t.Fatalf("without grants, application access = active %v, eligible %v", active, eligible)
	}
	active, eligible = developerorganizations.ApplicationCapabilitiesForGrant("developer", []string{"credentials.manage", "billing.manage"})
	if !reflect.DeepEqual(active, []string{"credentials.manage"}) || len(eligible) != 5 {
		t.Fatalf("grant intersection = active %v, eligible %v", active, eligible)
	}
}

func TestEligibleApplicationCapabilitiesReturnsCopyAndRoleSubset(t *testing.T) {
	eligible := developerorganizations.EligibleApplicationCapabilities("analyst")
	if !reflect.DeepEqual(eligible, []string{"request_logs.read", "usage.read"}) {
		t.Fatalf("analyst eligible capabilities = %v", eligible)
	}
	eligible[0] = "credentials.manage"
	if developerorganizations.EligibleApplicationCapabilities("analyst")[0] != "request_logs.read" {
		t.Fatal("eligible application capabilities exposed mutable role state")
	}
	if len(developerorganizations.EligibleApplicationCapabilities("billing")) != 0 {
		t.Fatal("billing role received application capabilities")
	}
}

func TestOrganizationRoleAssignmentCannotEscalatePrivileges(t *testing.T) {
	for _, target := range []string{"admin", "developer", "analyst", "billing"} {
		if !developerorganizations.CanAssignOrganizationRole("owner", target) {
			t.Errorf("owner cannot assign %q", target)
		}
	}
	for _, target := range []string{"admin", "developer", "analyst"} {
		if !developerorganizations.CanAssignOrganizationRole("admin", target) {
			t.Errorf("admin cannot assign %q", target)
		}
	}
	for _, target := range []string{"owner", "billing", "unknown"} {
		if developerorganizations.CanAssignOrganizationRole("admin", target) {
			t.Errorf("admin can assign forbidden role %q", target)
		}
	}
	if developerorganizations.CanAssignOrganizationRole("billing", "developer") {
		t.Fatal("billing manager can assign developer")
	}
}
