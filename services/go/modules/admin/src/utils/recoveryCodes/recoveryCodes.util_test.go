package recoverycodes

import (
	"regexp"
	"testing"
)

func TestGeneratesEightDistinctCodesInTheDisplayFormat(t *testing.T) {
	codes, err := Generate()
	if err != nil {
		t.Fatal(err)
	}
	if len(codes) != Count {
		t.Fatalf("got %d codes", len(codes))
	}
	format := regexp.MustCompile(`^[0-9A-F]{5}-[0-9A-F]{5}$`)
	seen := map[string]bool{}
	for _, code := range codes {
		if !format.MatchString(code) || seen[code] {
			t.Fatalf("bad or repeated code %q", code)
		}
		seen[code] = true
	}
}

func TestEachCodeIsSingleUseAndNormalizedBeforeHashing(t *testing.T) {
	key := DeriveHashKey([]byte("master-key-for-tests-0123456789ab"))
	stored := HashAll(key, []string{"ABCDE-12345", "FFFFF-00000"})
	remaining, ok := Consume(key, stored, " abcde 12345 ")
	if !ok || len(remaining) != 1 {
		t.Fatalf("expected the normalized code to match once, got %v %v", ok, remaining)
	}
	if _, again := Consume(key, remaining, "ABCDE-12345"); again {
		t.Fatal("a used code must not work twice")
	}
	if _, wrongKey := Consume(DeriveHashKey([]byte("other")), stored, "ABCDE-12345"); wrongKey {
		t.Fatal("hashes are keyed")
	}
	if !LooksLikeRecoveryCode("abcde-12345") || LooksLikeRecoveryCode("123456") || LooksLikeRecoveryCode("<script>") {
		t.Fatal("recovery code shape check is wrong")
	}
}
