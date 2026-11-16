package utils_test

import (
	"testing"

	"nantty/modules/payments/src/utils"
)

func TestAdsAccountReturnUrlsMatchOnlyTheBillingReturnPageOnAllowedOrigins(t *testing.T) {
	origins := []string{"https://ads.nantty.com", "http://localhost:3300"}
	cases := map[string]bool{
		"https://ads.nantty.com/accounts/acct_123/billing/return":         true,
		"http://localhost:3300/accounts/01a10d07-5689/billing/return":     true,
		"https://ads.nantty.com/accounts/acct_123/billing/return/":        false,
		"https://ads.nantty.com/accounts/acct_123/billing/return?next=/x": false,
		"https://ads.nantty.com/accounts/acct_123/billing/return#x":       false,
		"https://ads.nantty.com/accounts/../billing/return":               false,
		"https://ads.nantty.com/accounts/a%2Fb/billing/return":            false,
		"https://ads.nantty.com/accounts/a/b/billing/return":              false,
		"https://ads.nantty.com.evil.test/accounts/a/billing/return":      false,
		"https://evil.test@ads.nantty.com/accounts/a/billing/return":      false,
		"http://ads.nantty.com/accounts/a/billing/return":                 false,
		"https://ads.nantty.com:8443/accounts/a/billing/return":           false,
		"//ads.nantty.com/accounts/a/billing/return":                      false,
		"javascript:alert(1)//ads.nantty.com/accounts/a/billing/return":   false,
		"https://ads.nantty.com\\@evil.test/accounts/a/billing/return":    false,
		"https://ads.nantty.com/accounts/acct_123/billing/settings":       false,
		"https://ADS.nantty.com/accounts/acct_123/billing/return":         false,
		"": false,
	}
	for raw, want := range cases {
		if got := utils.IsAdsAccountReturnUrl(raw, origins); got != want {
			t.Errorf("%q: got %v, want %v", raw, got, want)
		}
	}
	if utils.IsAdsAccountReturnUrl("https://ads.nantty.com/accounts/a/billing/return", nil) {
		t.Fatal("no configured origins must allow nothing")
	}
}
