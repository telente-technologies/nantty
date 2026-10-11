package passwordhash

import "testing"

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

func TestTheTimingDummyIsRandomPerProcessAndMatchesNoGuessablePassword(t *testing.T) {
	first := NewPasswordHasher(RecommendedArgon2idParameters)
	second := NewPasswordHasher(RecommendedArgon2idParameters)
	if first.dummyPasswordHash == "" || first.dummyPasswordHash == second.dummyPasswordHash {
		t.Fatal("each hasher needs its own random dummy hash")
	}
	if matches, _ := first.VerifyPasswordAgainstArgon2idHash("zudomart-timing-equaliser-1", first.dummyPasswordHash); matches {
		t.Fatal("the old published dummy password must not match")
	}
}
