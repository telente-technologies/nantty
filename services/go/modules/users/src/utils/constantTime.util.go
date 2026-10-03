package utils

import "crypto/subtle"

func SecretsMatch(expected, presented string) bool {
	return expected != "" && subtle.ConstantTimeCompare([]byte(expected), []byte(presented)) == 1
}
