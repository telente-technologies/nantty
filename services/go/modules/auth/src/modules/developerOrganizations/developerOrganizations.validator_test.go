package developerorganizations

import "testing"

func TestValidateCreateRequest(t *testing.T) {
	tests := []struct {
		name    string
		request CreateRequest
		valid   bool
	}{
		{name: "valid", request: CreateRequest{Name: "Nantty Labs", Slug: "nantty-labs"}, valid: true},
		{name: "trimmed name", request: CreateRequest{Name: "  Nantty Labs  ", Slug: "nantty-labs"}, valid: true},
		{name: "short name", request: CreateRequest{Name: "A", Slug: "nantty-labs"}},
		{name: "uppercase slug", request: CreateRequest{Name: "Nantty Labs", Slug: "Nantty-Labs"}},
		{name: "leading dash", request: CreateRequest{Name: "Nantty Labs", Slug: "-nantty"}},
		{name: "consecutive dashes", request: CreateRequest{Name: "Nantty Labs", Slug: "nantty--labs"}},
		{name: "short slug", request: CreateRequest{Name: "Nantty Labs", Slug: "na"}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := validateCreateRequest(test.request)
			if (err == nil) != test.valid {
				t.Fatalf("validateCreateRequest() error = %v, valid = %t", err, test.valid)
			}
		})
	}
}
