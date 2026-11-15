package developerapplications

import (
	"reflect"
	"testing"
)

func TestNormalizeApplicationInput(t *testing.T) {
	input := ApplicationInput{
		Name: "  Nantty CRM  ", Purpose: "Connect customer support to Nantty business messaging.",
		CallbackOrigins: []string{"https://CRM.example.com/", "http://localhost:3000", "https://crm.example.com"},
		RequestedScopes: []string{"messages:read", "messages:send", "messages:read"},
	}
	got, err := normalizeApplicationInput(input)
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
	base := ApplicationInput{Name: "Nantty CRM", Purpose: "Connect customer support to Nantty business messaging.", RequestedScopes: []string{"messages:send"}}
	tests := []struct {
		name   string
		change func(*ApplicationInput)
	}{
		{"non-local insecure callback", func(input *ApplicationInput) { input.CallbackOrigins = []string{"http://crm.example.com"} }},
		{"callback with path", func(input *ApplicationInput) { input.CallbackOrigins = []string{"https://crm.example.com/callback"} }},
		{"callback with credentials", func(input *ApplicationInput) {
			input.CallbackOrigins = []string{"https://user:password@crm.example.com"}
		}},
		{"unknown requested scope", func(input *ApplicationInput) { input.RequestedScopes = []string{"account:admin"} }},
		{"short purpose", func(input *ApplicationInput) { input.Purpose = "CRM" }},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			input := base
			test.change(&input)
			if _, err := normalizeApplicationInput(input); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}

func TestNormalizeGrantCapabilitiesDeduplicatesAndSorts(t *testing.T) {
	got, err := normalizeGrantCapabilities([]string{"usage.read", "applications.read", "usage.read"})
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, []string{"applications.read", "usage.read"}) {
		t.Fatalf("normalized grants = %v", got)
	}
}

func TestNormalizeGrantCapabilitiesRejectsRequestedScopesAndUnknownValues(t *testing.T) {
	if _, err := normalizeGrantCapabilities(nil); err == nil {
		t.Fatal("accepted omitted capabilities; callers must send an explicit array to revoke grants")
	}
	for _, capability := range []string{"messages:send", "applications.manage", "account:admin"} {
		if _, err := normalizeGrantCapabilities([]string{capability}); err == nil {
			t.Errorf("accepted invalid application capability %q", capability)
		}
	}
	if _, err := normalizeGrantCapabilities(make([]string, len(allGrantCapabilities)+1)); err == nil {
		t.Fatal("accepted more grants than the capability catalog")
	}
}
