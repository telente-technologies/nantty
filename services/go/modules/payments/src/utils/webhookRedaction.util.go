package utils

import "regexp"

var reusableCardSecretPattern = regexp.MustCompile(`"(authorization_code|signature)"\s*:\s*"[^"]*"`)

func RedactReusableCardSecrets(rawBody []byte) []byte {
	return reusableCardSecretPattern.ReplaceAll(rawBody, []byte(`"$1":"[redacted]"`))
}
