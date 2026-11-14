package developerorganizations

import (
	"reflect"
	"testing"
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
			organization, application := capabilitiesForRole(test.role)
			if !reflect.DeepEqual(organization, test.organization) || !reflect.DeepEqual(application, test.application) {
				t.Fatalf("capabilitiesForRole(%q) = %v %v", test.role, organization, application)
			}
		})
	}
}

func TestApplicationCapabilitiesRequireBothRoleAndApplicationGrant(t *testing.T) {
	if AllowsApplicationCapability("developer", "credentials.manage", false) {
		t.Fatal("developer without an application grant was allowed")
	}
	if !AllowsApplicationCapability("developer", "credentials.manage", true) {
		t.Fatal("developer with an application grant was denied")
	}
	if AllowsApplicationCapability("analyst", "credentials.manage", true) {
		t.Fatal("analyst was granted credential management")
	}
	if !AllowsOrganizationCapability("billing", "billing.manage") {
		t.Fatal("billing role was denied billing management")
	}
	if AllowsOrganizationCapability("admin", "billing.manage") {
		t.Fatal("admin was granted billing management")
	}
	if AllowsOrganizationCapability("unknown", "organization.read") {
		t.Fatal("unknown role was granted access")
	}
}

func TestOrganizationRoleAssignmentCannotEscalatePrivileges(t *testing.T) {
	for _, target := range []string{"admin", "developer", "analyst", "billing"} {
		if !CanAssignOrganizationRole("owner", target) {
			t.Errorf("owner cannot assign %q", target)
		}
	}
	for _, target := range []string{"admin", "developer", "analyst"} {
		if !CanAssignOrganizationRole("admin", target) {
			t.Errorf("admin cannot assign %q", target)
		}
	}
	for _, target := range []string{"owner", "billing", "unknown"} {
		if CanAssignOrganizationRole("admin", target) {
			t.Errorf("admin can assign forbidden role %q", target)
		}
	}
	if CanAssignOrganizationRole("billing", "developer") {
		t.Fatal("billing manager can assign developer")
	}
}
