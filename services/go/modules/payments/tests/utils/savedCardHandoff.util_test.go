package utils_test

import (
	"testing"
	"time"

	"nantty/modules/payments/src/utils"
)

func TestSavedCardHandoffIsSingleUseAndExpires(t *testing.T) {
	now := time.Date(2026, 10, 3, 10, 0, 0, 0, time.UTC)
	store := utils.NewMemorySavedCardHandoffStore(15 * time.Minute)
	store.Now = func() time.Time { return now }
	store.Offer("zmcard_1", utils.SavedCardHandoff{PaymentMethodId: "pm_1", ProviderCustomerId: "cust_1"})
	if handoff, found := store.Take("zmcard_1"); !found || handoff.PaymentMethodId != "pm_1" {
		t.Fatal("the card must be handed to the device once")
	}
	if _, found := store.Take("zmcard_1"); found {
		t.Fatal("the card must not be handed out twice")
	}
	store.Offer("zmcard_2", utils.SavedCardHandoff{PaymentMethodId: "pm_2"})
	now = now.Add(16 * time.Minute)
	if _, found := store.Take("zmcard_2"); found {
		t.Fatal("an expired handoff must be dropped")
	}
}

func TestCardFingerprintIsKeyedAndStable(t *testing.T) {
	first := utils.HashSavedCardFingerprint("key-a", "", "Visa", "4242", 9, 2029)
	if first != utils.HashSavedCardFingerprint("key-a", "", "visa", "4242", 9, 2029) || first == utils.HashSavedCardFingerprint("key-b", "", "visa", "4242", 9, 2029) {
		t.Fatal("the fingerprint must be stable per key and differ across keys")
	}
	if utils.HashSavedCardFingerprint("key-a", "fp_1", "visa", "4242", 9, 2029) == first || len(first) != 64 {
		t.Fatal("a provider fingerprint wins over card details")
	}
}
