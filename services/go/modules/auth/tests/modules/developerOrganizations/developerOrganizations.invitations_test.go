package developerorganizations_test

import (
	"testing"

	developerorganizations "nantty/modules/auth/src/modules/developerOrganizations"
)

func TestNormalizeInvitationEmail(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
		valid bool
	}{
		{name: "normalized address", input: "  Developer@Example.COM ", want: "developer@example.com", valid: true},
		{name: "reject display name", input: "Developer <developer@example.com>"},
		{name: "reject malformed address", input: "developer at example.com"},
		{name: "reject empty address", input: " "},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := developerorganizations.NormalizeInvitationEmail(test.input)
			if (err == nil) != test.valid {
				t.Fatalf("normalizeInvitationEmail() error = %v, valid = %t", err, test.valid)
			}
			if got != test.want {
				t.Fatalf("normalized email = %q, want %q", got, test.want)
			}
		})
	}
}
