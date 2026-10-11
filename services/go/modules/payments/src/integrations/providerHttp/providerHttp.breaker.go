package providerhttp

import (
	"regexp"
	"sync"
	"time"
)

type Breaker struct {
	FailureThreshold int
	OpenFor          time.Duration
	mutex            sync.Mutex
	failures         int
	openedUntil      time.Time
}

func NewBreaker() *Breaker {
	return &Breaker{FailureThreshold: 5, OpenFor: 15 * time.Second}
}

func (breaker *Breaker) Allow(now time.Time) bool {
	breaker.mutex.Lock()
	defer breaker.mutex.Unlock()
	return !now.Before(breaker.openedUntil)
}

func (breaker *Breaker) Record(now time.Time, succeeded bool) {
	breaker.mutex.Lock()
	defer breaker.mutex.Unlock()
	if succeeded {
		breaker.failures = 0
		return
	}
	breaker.failures++
	if breaker.failures >= max(breaker.FailureThreshold, 1) {
		breaker.openedUntil, breaker.failures = now.Add(breaker.OpenFor), 0
	}
}

var secretPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)\b(sk|pk)_(live|test)_[A-Za-z0-9]+`),
	regexp.MustCompile(`FLW(SECK|PUBK)(_TEST)?-[A-Za-z0-9-]+`),
	regexp.MustCompile(`(?i)bearer\s+[A-Za-z0-9._~+/=-]+`),
	regexp.MustCompile(`(?i)(verif-hash|flutterwave-signature|x-paystack-signature)["':=\s]+[^\s"',}]+`),
	regexp.MustCompile(`(?i)("?(account_number|accountnumber|bvn|nuban|authorization_code|token)"?\s*[:=]\s*"?)[A-Za-z0-9_-]{4,}`),
}

func RedactSecrets(text string) string {
	for index, pattern := range secretPatterns {
		if index == len(secretPatterns)-1 {
			text = pattern.ReplaceAllString(text, "${1}[redacted]")
			continue
		}
		text = pattern.ReplaceAllString(text, "[redacted]")
	}
	return text
}
