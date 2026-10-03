package totp

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"crypto/subtle"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"net/url"
	"time"
)

const (
	StepSeconds    = 30
	SecretBytes    = 20
	DefaultDigits  = 6
	allowedDrift   = 1
	digitsModulus6 = 1_000_000
)

var secretEncoding = base32.StdEncoding.WithPadding(base32.NoPadding)

func GenerateSecret() ([]byte, error) {
	secret := make([]byte, SecretBytes)
	if _, err := rand.Read(secret); err != nil {
		return nil, err
	}
	return secret, nil
}

func EncodeSecretForAuthenticatorApps(secret []byte) string {
	return secretEncoding.EncodeToString(secret)
}

func StepAt(moment time.Time) int64 { return moment.Unix() / StepSeconds }

func ComputeCode(secret []byte, step int64, digits int) string {
	mac := hmac.New(sha1.New, secret)
	var counter [8]byte
	binary.BigEndian.PutUint64(counter[:], uint64(step))
	mac.Write(counter[:])
	sum := mac.Sum(nil)
	offset := sum[len(sum)-1] & 0x0f
	truncated := binary.BigEndian.Uint32(sum[offset:offset+4]) & 0x7fffffff
	modulus := uint32(1)
	for range digits {
		modulus *= 10
	}
	return fmt.Sprintf("%0*d", digits, truncated%modulus)
}

func VerifyCodeRejectingReplays(secret []byte, code string, now time.Time, lastUsedStep int64) (int64, bool) {
	if len(code) != DefaultDigits {
		return 0, false
	}
	matchedStep, matched := int64(0), false
	for drift := int64(-allowedDrift); drift <= allowedDrift; drift++ {
		step := StepAt(now) + drift
		equal := subtle.ConstantTimeCompare([]byte(ComputeCode(secret, step, DefaultDigits)), []byte(code)) == 1
		if equal && step > lastUsedStep && !matched {
			matchedStep, matched = step, true
		}
	}
	return matchedStep, matched
}

func BuildProvisioningUri(issuerLabel, accountName string, secret []byte) string {
	label := url.PathEscape(issuerLabel + ":" + accountName)
	query := url.Values{"secret": {EncodeSecretForAuthenticatorApps(secret)}, "issuer": {issuerLabel}, "algorithm": {"SHA1"}, "digits": {"6"}, "period": {"30"}}
	return "otpauth://totp/" + label + "?" + query.Encode()
}
