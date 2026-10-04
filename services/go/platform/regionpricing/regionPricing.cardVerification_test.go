package regionpricing

import "testing"

func TestCardVerificationChargeIsSmallAndRegional(t *testing.T) {
	if amount, currency := CardVerificationCharge("ngn"); amount != 5_000 || currency != "NGN" {
		t.Fatalf("Nigeria charges ₦50, got %d %s", amount, currency)
	}
	for _, region := range SupportedRegions() {
		if amount, currency := CardVerificationCharge(region.Currency); amount <= 0 || currency != region.Currency {
			t.Fatalf("%s has no verification charge", region.Currency)
		}
	}
	if amount, currency := CardVerificationCharge("XOF"); amount != 100 || currency != "USD" {
		t.Fatalf("unsupported currencies fall back to USD, got %d %s", amount, currency)
	}
}
