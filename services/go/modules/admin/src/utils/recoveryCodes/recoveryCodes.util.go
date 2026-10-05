package recoverycodes

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"regexp"
	"strings"
)

const Count = 8

var presentedCodePattern = regexp.MustCompile(`^[A-Za-z0-9-]{8,20}$`)

func LooksLikeRecoveryCode(code string) bool {
	return presentedCodePattern.MatchString(strings.ReplaceAll(code, " ", ""))
}

func Generate() ([]string, error) {
	codes := make([]string, 0, Count)
	for range Count {
		buffer := make([]byte, 5)
		if _, err := rand.Read(buffer); err != nil {
			return nil, err
		}
		raw := strings.ToUpper(hex.EncodeToString(buffer))
		codes = append(codes, raw[:5]+"-"+raw[5:])
	}
	return codes, nil
}

func Normalize(code string) string {
	return strings.ToUpper(strings.NewReplacer(" ", "", "-", "", "\t", "").Replace(code))
}

func DeriveHashKey(masterKey []byte) []byte {
	mac := hmac.New(sha256.New, masterKey)
	mac.Write([]byte("zudomart-admin-recovery-codes"))
	return mac.Sum(nil)
}

func Hash(key []byte, code string) string {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(Normalize(code)))
	return hex.EncodeToString(mac.Sum(nil))
}

func HashAll(key []byte, codes []string) []string {
	hashes := make([]string, 0, len(codes))
	for _, code := range codes {
		hashes = append(hashes, Hash(key, code))
	}
	return hashes
}

func Consume(key []byte, stored []string, presented string) ([]string, bool) {
	presentedHash := []byte(Hash(key, presented))
	remaining := make([]string, 0, len(stored))
	matched := false
	for _, candidate := range stored {
		if !matched && hmac.Equal([]byte(candidate), presentedHash) {
			matched = true
			continue
		}
		remaining = append(remaining, candidate)
	}
	return remaining, matched
}
