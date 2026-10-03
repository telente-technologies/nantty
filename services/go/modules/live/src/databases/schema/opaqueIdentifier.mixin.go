package schema

import (
	"crypto/rand"
	"encoding/base64"
	"time"
)

func timeNow() time.Time { return time.Now() }

func NewOpaqueSceneIdentifier() string {
	random := make([]byte, 18)
	if _, err := rand.Read(random); err != nil {
		panic("operating system random source failed: " + err.Error())
	}
	return "scn_" + base64.RawURLEncoding.EncodeToString(random)
}
