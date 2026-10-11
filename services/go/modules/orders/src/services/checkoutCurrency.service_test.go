package services

import "testing"

func TestCheckoutCurrencyMustBeAServerSupportedIsoCode(t *testing.T) {
	allowed := []string{"NGN", "USD"}
	cases := map[string]bool{"NGN": true, "USD": true, "GHS": false, "ngn": false, "": false, "NAIRA": false, "N G": false}
	for currency, want := range cases {
		if got := CheckoutCurrencySupported(allowed, currency); got != want {
			t.Fatalf("%q: got %v, want %v", currency, got, want)
		}
	}
	if !CheckoutCurrencySupported(nil, "GHS") || CheckoutCurrencySupported(nil, "gh") {
		t.Fatal("without a configured list any valid ISO code passes and malformed codes fail")
	}
}
