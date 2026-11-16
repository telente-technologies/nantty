package services_test

import (
	"testing"

	"nantty/modules/orders/src/services"
)

func TestCheckoutCurrencyMustBeAServerSupportedIsoCode(t *testing.T) {
	allowed := []string{"NGN", "USD"}
	cases := map[string]bool{"NGN": true, "USD": true, "GHS": false, "ngn": false, "": false, "NAIRA": false, "N G": false}
	for currency, want := range cases {
		if got := services.CheckoutCurrencySupported(allowed, currency); got != want {
			t.Fatalf("%q: got %v, want %v", currency, got, want)
		}
	}
	if !services.CheckoutCurrencySupported(nil, "GHS") || services.CheckoutCurrencySupported(nil, "gh") {
		t.Fatal("without a configured list any valid ISO code passes and malformed codes fail")
	}
}
