package utils_test

import (
	"bytes"
	"testing"

	"nantty/modules/auth/src/utils"
)

func TestSealAndOpenRoundTripAndTamperDetection(t *testing.T) {
	key := bytes.Repeat([]byte{7}, 32)
	sealed, err := utils.SealWithAesGcm(key, []byte("private key"))
	if err != nil {
		t.Fatal(err)
	}
	opened, err := utils.OpenWithAesGcm(key, sealed)
	if err != nil || string(opened) != "private key" {
		t.Fatalf("round trip failed: %v", err)
	}
	sealed[len(sealed)-1] ^= 1
	if _, err := utils.OpenWithAesGcm(key, sealed); err == nil {
		t.Fatal("tampered ciphertext must not open")
	}
}

func TestOneTimeCodesAreSixDigitsAndHashesBindDestinationAndPurpose(t *testing.T) {
	code, err := utils.GenerateSixDigitOneTimeCode()
	if err != nil || len(code) != 6 {
		t.Fatalf("bad code %q %v", code, err)
	}
	pepper := []byte("pepper")
	if utils.HashOneTimeCodeWithPepper(pepper, "a@b.co", "signup", code) == utils.HashOneTimeCodeWithPepper(pepper, "a@b.co", "reset", code) {
		t.Fatal("purpose must change the hash")
	}
}
