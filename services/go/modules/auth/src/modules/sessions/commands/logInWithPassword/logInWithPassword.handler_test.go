package loginwithpassword

import "testing"

func TestNormalizeLoginIdentifierMatchesRegistration(t *testing.T) {
	cases := []struct {
		name, input, want string
		isEmail           bool
	}{
		{"plain username", "alice", "alice", false},
		{"at prefix and case", "  @Alice ", "alice", false},
		{"fullwidth letters fold via NFKC", "ａｌｉｃｅ", "alice", false},
		{"fullwidth at prefix", "＠alice", "alice", false},
		{"email lowercased", " Alice@Example.COM ", "alice@example.com", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, isEmail := normalizeLoginIdentifier(tc.input)
			if got != tc.want || isEmail != tc.isEmail {
				t.Fatalf("normalizeLoginIdentifier(%q) = %q,%v want %q,%v", tc.input, got, isEmail, tc.want, tc.isEmail)
			}
		})
	}
}
