package integrations

import (
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func TestNonceAcceptsTheRawOrHashedFormAndNothingElse(t *testing.T) {
	raw := "nonce-0123456789"
	hashed := sha256.Sum256([]byte(raw))
	if !nonceMatches(raw, raw) || !nonceMatches(hex.EncodeToString(hashed[:]), raw) {
		t.Fatal("the raw nonce and its SHA-256 hex must both match")
	}
	for _, claimed := range []string{"", "nonce-0123456788", hex.EncodeToString(hashed[:])[:10]} {
		if nonceMatches(claimed, raw) {
			t.Fatalf("claimed nonce %q must not match", claimed)
		}
	}
}
