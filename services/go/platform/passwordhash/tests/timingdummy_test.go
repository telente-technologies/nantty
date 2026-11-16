package passwordhash_test

import (
	"encoding/base64"
	"testing"

	"nantty/platform/passwordhash/internal/timingdummy"
)

func TestTimingDummyUsesFreshUnpublishedRandomPasswordMaterial(t *testing.T) {
	const legacyGuess = "nantty-timing-equaliser-1"
	seen := map[string]struct{}{}
	for range 2 {
		var source string
		encodedHash := timingdummy.HashPassword(func(password string) (string, error) {
			source = password
			return "test-hash:" + password, nil
		})
		if source == "" || source == legacyGuess {
			t.Fatal("dummy password material must be random and must not use the legacy guess")
		}
		material, err := base64.RawStdEncoding.DecodeString(source)
		if err != nil || len(material) != 32 {
			t.Fatalf("dummy material must be 32 random bytes encoded as base64: %v", err)
		}
		if _, exists := seen[source]; exists {
			t.Fatal("each hasher must use fresh dummy password material")
		}
		seen[source] = struct{}{}
		if encodedHash != "test-hash:"+source {
			t.Fatal("the dummy password material must only leave the helper through the configured password hasher")
		}
	}
}
