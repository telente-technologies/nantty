package timingdummy

import (
	"crypto/rand"
	"encoding/base64"
)

func HashPassword(hashPassword func(string) (string, error)) string {
	material := make([]byte, 32)
	if _, err := rand.Read(material); err != nil {
		return ""
	}
	hash, _ := hashPassword(base64.RawStdEncoding.EncodeToString(material))
	return hash
}
