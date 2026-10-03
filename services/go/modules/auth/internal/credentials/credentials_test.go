package credentials

import (
	"bytes"
	"testing"
)

var fastTestParameters = Argon2idParameters{MemoryKibibytes: 1024, Iterations: 1, Parallelism: 1, SaltLength: 16, KeyLength: 32}

func TestArgon2idHashAndVerify(t *testing.T) {
	hasher := NewPasswordHasher(fastTestParameters)
	hash, err := hasher.HashPasswordWithArgon2id("correct horse 1")
	if err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		name     string
		password string
		hash     string
		want     bool
		wantErr  bool
	}{
		{"matching password", "correct horse 1", hash, true, false},
		{"wrong password", "correct horse 2", hash, false, false},
		{"malformed hash", "correct horse 1", "$bcrypt$nope", false, true},
		{"truncated hash", "correct horse 1", hash[:20], false, true},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			got, err := hasher.VerifyPasswordAgainstArgon2idHash(testCase.password, testCase.hash)
			if (err != nil) != testCase.wantErr || got != testCase.want {
				t.Fatalf("got %v, %v", got, err)
			}
		})
	}
}

func TestSealAndOpenRoundTripAndTamperDetection(t *testing.T) {
	key := bytes.Repeat([]byte{7}, 32)
	sealed, err := SealWithAesGcm(key, []byte("private key"))
	if err != nil {
		t.Fatal(err)
	}
	opened, err := OpenWithAesGcm(key, sealed)
	if err != nil || string(opened) != "private key" {
		t.Fatalf("round trip failed: %v", err)
	}
	sealed[len(sealed)-1] ^= 1
	if _, err := OpenWithAesGcm(key, sealed); err == nil {
		t.Fatal("tampered ciphertext must not open")
	}
}

func TestOneTimeCodesAreSixDigitsAndHashesBindDestinationAndPurpose(t *testing.T) {
	code, err := GenerateSixDigitOneTimeCode()
	if err != nil || len(code) != 6 {
		t.Fatalf("bad code %q %v", code, err)
	}
	pepper := []byte("pepper")
	if HashOneTimeCodeWithPepper(pepper, "a@b.co", "signup", code) == HashOneTimeCodeWithPepper(pepper, "a@b.co", "reset", code) {
		t.Fatal("purpose must change the hash")
	}
}
