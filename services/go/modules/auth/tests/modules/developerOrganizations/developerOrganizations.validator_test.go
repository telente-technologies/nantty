package developerorganizations_test

import (
	"testing"

	"nantty/modules/auth/src/modules/developerOrganizations"
)

func TestValidateCreateRequest(t *testing.T) {
	tests := []struct {
		name    string
		request developerorganizations.CreateRequest
		valid   bool
	}{
		{name: "valid", request: developerorganizations.CreateRequest{Name: "Nantty Labs", Slug: "nantty-labs"}, valid: true},
		{name: "trimmed name", request: developerorganizations.CreateRequest{Name: "  Nantty Labs  ", Slug: "nantty-labs"}, valid: true},
		{name: "short name", request: developerorganizations.CreateRequest{Name: "A", Slug: "nantty-labs"}},
		{name: "uppercase slug", request: developerorganizations.CreateRequest{Name: "Nantty Labs", Slug: "Nantty-Labs"}},
		{name: "leading dash", request: developerorganizations.CreateRequest{Name: "Nantty Labs", Slug: "-nantty"}},
		{name: "consecutive dashes", request: developerorganizations.CreateRequest{Name: "Nantty Labs", Slug: "nantty--labs"}},
		{name: "short slug", request: developerorganizations.CreateRequest{Name: "Nantty Labs", Slug: "na"}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := developerorganizations.ValidateCreateRequest(test.request)
			if (err == nil) != test.valid {
				t.Fatalf("ValidateCreateRequest() error = %v, valid = %t", err, test.valid)
			}
		})
	}
}
