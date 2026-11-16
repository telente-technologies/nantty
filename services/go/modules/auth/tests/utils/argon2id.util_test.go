package utils_test

import (
	"testing"

	"nantty/modules/auth/src/utils"
)

var fastTestParameters = utils.Argon2idParameters{MemoryKibibytes: 1024, Iterations: 1, Parallelism: 1, SaltLength: 16, KeyLength: 32}

func TestArgon2idHashAndVerify(t *testing.T) {
	hasher := utils.NewPasswordHasher(fastTestParameters)
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
