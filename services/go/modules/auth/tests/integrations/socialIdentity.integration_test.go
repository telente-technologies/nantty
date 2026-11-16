package integrations_test

import (
	"crypto/sha256"
	"encoding/hex"
	"testing"

	"nantty/modules/auth/src/integrations"
)

func TestNonceAcceptsTheRawOrHashedFormAndNothingElse(t *testing.T) {
	raw := "nonce-0123456789"
	hashed := sha256.Sum256([]byte(raw))
	if !integrations.NonceMatches(raw, raw) || !integrations.NonceMatches(hex.EncodeToString(hashed[:]), raw) {
		t.Fatal("the raw nonce and its SHA-256 hex must both match")
	}
	for _, claimed := range []string{"", "nonce-0123456788", hex.EncodeToString(hashed[:])[:10]} {
		if integrations.NonceMatches(claimed, raw) {
			t.Fatalf("claimed nonce %q must not match", claimed)
		}
	}
}
