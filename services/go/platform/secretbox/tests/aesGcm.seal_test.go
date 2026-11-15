package secretbox_test

import (
	"bytes"
	. "nantty/platform/secretbox"
	"testing"
)

func TestSealAndOpenRoundTripAndTamperDetection(t *testing.T) {
	key := bytes.Repeat([]byte{7}, 32)
	sealed, err := SealWithAesGcm(key, []byte("totp secret"))
	if err != nil {
		t.Fatal(err)
	}
	opened, err := OpenWithAesGcm(key, sealed)
	if err != nil || string(opened) != "totp secret" {
		t.Fatalf("round trip failed: %v", err)
	}
	sealed[len(sealed)-1] ^= 1
	if _, err := OpenWithAesGcm(key, sealed); err == nil {
		t.Fatal("tampered ciphertext must not open")
	}
}
