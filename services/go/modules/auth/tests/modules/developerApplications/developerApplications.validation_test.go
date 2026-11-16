package developerapplications_test

import (
	"reflect"
	"testing"

	"nantty/modules/auth/src/modules/developerApplications"
)

func TestNormalizeApplicationInput(t *testing.T) {
	input := developerapplications.ApplicationInput{
		Name: "  Nantty CRM  ", Purpose: "Connect customer support to Nantty business messaging.",
		CallbackOrigins: []string{"https://CRM.example.com/", "http://localhost:3000", "https://crm.example.com"},
		RequestedScopes: []string{"messages:read", "messages:send", "messages:read"},
	}
	got, err := developerapplications.NormalizeDeveloperApplicationInput(input)
	if err != nil {
		t.Fatal(err)
	}
	if got.Name != "Nantty CRM" || !reflect.DeepEqual(got.CallbackOrigins, []string{"http://localhost:3000", "https://crm.example.com"}) {
		t.Fatalf("normalized application = %#v", got)
	}
	if !reflect.DeepEqual(got.RequestedScopes, []string{"messages:read", "messages:send"}) {
		t.Fatalf("normalized scopes = %#v", got.RequestedScopes)
	}
}

func TestNormalizeApplicationInputRejectsUnsafeOrUnregisteredValues(t *testing.T) {
	base := developerapplications.ApplicationInput{Name: "Nantty CRM", Purpose: "Connect customer support to Nantty business messaging.", RequestedScopes: []string{"messages:send"}}
	tests := []struct {
		name   string
		change func(*developerapplications.ApplicationInput)
	}{
		{"non-local insecure callback", func(input *developerapplications.ApplicationInput) {
			input.CallbackOrigins = []string{"http://crm.example.com"}
		}},
		{"callback with path", func(input *developerapplications.ApplicationInput) {
			input.CallbackOrigins = []string{"https://crm.example.com/callback"}
		}},
		{"callback with credentials", func(input *developerapplications.ApplicationInput) {
			input.CallbackOrigins = []string{"https://user:password@crm.example.com"}
		}},
		{"unknown requested scope", func(input *developerapplications.ApplicationInput) { input.RequestedScopes = []string{"account:admin"} }},
		{"short purpose", func(input *developerapplications.ApplicationInput) { input.Purpose = "CRM" }},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			input := base
			test.change(&input)
			if _, err := developerapplications.NormalizeDeveloperApplicationInput(input); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}

func TestNormalizeGrantCapabilitiesDeduplicatesAndSorts(t *testing.T) {
	got, err := developerapplications.NormalizeDeveloperApplicationGrantCapabilities([]string{"usage.read", "applications.read", "usage.read"})
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, []string{"applications.read", "usage.read"}) {
		t.Fatalf("normalized grants = %v", got)
	}
}

func TestNormalizeGrantCapabilitiesRejectsRequestedScopesAndUnknownValues(t *testing.T) {
	if _, err := developerapplications.NormalizeDeveloperApplicationGrantCapabilities(nil); err == nil {
		t.Fatal("accepted omitted capabilities; callers must send an explicit array to revoke grants")
	}
	for _, capability := range []string{"messages:send", "applications.manage", "account:admin"} {
		if _, err := developerapplications.NormalizeDeveloperApplicationGrantCapabilities([]string{capability}); err == nil {
			t.Errorf("accepted invalid application capability %q", capability)
		}
	}
	if _, err := developerapplications.NormalizeDeveloperApplicationGrantCapabilities([]string{"applications.read", "applications.read", "applications.read", "applications.read", "applications.read", "applications.read"}); err == nil {
		t.Fatal("accepted more grants than the capability catalog")
	}
}
