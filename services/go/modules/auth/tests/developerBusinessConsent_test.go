package auth_test

import (
	"testing"

	developerapplications "nantty/modules/auth/src/modules/developerApplications"
)

func TestNormalizeBusinessConsentScopes(t *testing.T) {
	got, err := developerapplications.NormalizeBusinessConsentScopes([]string{" messages:send ", "messages:send", "conversations:read"})
	if err != nil || len(got) != 2 || got[0] != "conversations:read" || got[1] != "messages:send" {
		t.Fatalf("normalized scopes = %v, %v", got, err)
	}
	for _, scopes := range [][]string{nil, {}, {"messages:send", "messages:read", "conversations:read", "messages:send"}, {"billing:manage"}} {
		if _, err := developerapplications.NormalizeBusinessConsentScopes(scopes); err == nil {
			t.Errorf("NormalizeBusinessConsentScopes(%v) unexpectedly succeeded", scopes)
		}
	}
}
