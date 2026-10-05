package utils

import "testing"

func TestAdsAccountReturnUrlsMatchOnlyTheBillingReturnPageOnAllowedOrigins(t *testing.T) {
	origins := []string{"https://ads.zudomart.com", "http://localhost:3300"}
	cases := map[string]bool{
		"https://ads.zudomart.com/accounts/acct_123/billing/return":         true,
		"http://localhost:3300/accounts/01a10d07-5689/billing/return":       true,
		"https://ads.zudomart.com/accounts/acct_123/billing/return/":        false,
		"https://ads.zudomart.com/accounts/acct_123/billing/return?next=/x": false,
		"https://ads.zudomart.com/accounts/acct_123/billing/return#x":       false,
		"https://ads.zudomart.com/accounts/../billing/return":               false,
		"https://ads.zudomart.com/accounts/a%2Fb/billing/return":            false,
		"https://ads.zudomart.com/accounts/a/b/billing/return":              false,
		"https://ads.zudomart.com.evil.test/accounts/a/billing/return":      false,
		"https://evil.test@ads.zudomart.com/accounts/a/billing/return":      false,
		"http://ads.zudomart.com/accounts/a/billing/return":                 false,
		"https://ads.zudomart.com:8443/accounts/a/billing/return":           false,
		"//ads.zudomart.com/accounts/a/billing/return":                      false,
		"javascript:alert(1)//ads.zudomart.com/accounts/a/billing/return":   false,
		"https://ads.zudomart.com\\@evil.test/accounts/a/billing/return":    false,
		"https://ads.zudomart.com/accounts/acct_123/billing/settings":       false,
		"https://ADS.zudomart.com/accounts/acct_123/billing/return":         false,
		"": false,
	}
	for raw, want := range cases {
		if got := IsAdsAccountReturnUrl(raw, origins); got != want {
			t.Errorf("%q: got %v, want %v", raw, got, want)
		}
	}
	if IsAdsAccountReturnUrl("https://ads.zudomart.com/accounts/a/billing/return", nil) {
		t.Fatal("no configured origins must allow nothing")
	}
}
