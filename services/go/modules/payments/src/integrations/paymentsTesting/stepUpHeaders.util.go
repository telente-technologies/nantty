package paymentstesting

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
)

func (harness *MoneyHarness) StepUpFor(accessToken string) http.Header {
	harness.T.Helper()
	parts := strings.Split(accessToken, ".")
	var claims struct {
		Subject string `json:"sub"`
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[min(1, len(parts)-1)])
	if err != nil || json.Unmarshal(payload, &claims) != nil || claims.Subject == "" {
		harness.T.Fatal("unreadable test access token")
	}
	return http.Header{"X-Step-Up-Token": {harness.Tokens.UserStepUpToken(claims.Subject)}}
}
