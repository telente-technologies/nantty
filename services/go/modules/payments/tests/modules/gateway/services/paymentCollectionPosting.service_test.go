package services_test

import (
	"testing"

	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/interfaces"
	"nantty/modules/payments/src/modules/gateway/services"
)

func TestProviderFeeMustFitVerifiedChargeAndSellerProceeds(t *testing.T) {
	intent := &ent.PaymentIntent{AmountMinor: 10_000}
	cases := []struct {
		name string
		fee  int64
		want bool
	}{
		{name: "zero fee", fee: 0, want: true},
		{name: "fee equals amount", fee: 10_000, want: true},
		{name: "negative rebate", fee: -1, want: false},
		{name: "fee exceeds gross", fee: 10_001, want: false},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			if got := services.ValidProviderFeeForIntent(intent, test.fee, intent.AmountMinor); got != test.want {
				t.Fatalf("ValidProviderFeeForIntent(%d) = %v, want %v", test.fee, got, test.want)
			}
		})
	}

	connected := &ent.PaymentIntent{AmountMinor: 10_000, PlatformFeeMinor: 1_000, ConnectedAccountID: "sub", BeneficiaryUserID: "seller"}
	if services.ValidProviderFeeForIntent(connected, 9_001, connected.AmountMinor) {
		t.Fatal("provider fee above gross less platform fee must not create negative seller proceeds")
	}
	if !services.ValidProviderFeeForIntent(connected, 9_000, connected.AmountMinor) {
		t.Fatal("provider fee equal to gross less platform fee leaves zero seller proceeds and is valid")
	}
}

func TestLateChargeMustMatchIntentAmountCurrencyAndProviderCharge(t *testing.T) {
	intent := &ent.PaymentIntent{AmountMinor: 10_000, Currency: "NGN"}
	verification := interfaces.ChargeVerification{AmountMinor: 10_000, Currency: "NGN", ProviderChargeId: "charge-1"}
	if !services.LateChargeMatchesIntent(intent, verification, "charge-1") {
		t.Fatal("matching late charge should be refundable")
	}
	for _, test := range []struct {
		name string
		edit func(*interfaces.ChargeVerification)
	}{
		{name: "amount mismatch", edit: func(v *interfaces.ChargeVerification) { v.AmountMinor++ }},
		{name: "currency mismatch", edit: func(v *interfaces.ChargeVerification) { v.Currency = "USD" }},
		{name: "provider charge mismatch", edit: func(v *interfaces.ChargeVerification) { v.ProviderChargeId = "other" }},
		{name: "negative provider fee", edit: func(v *interfaces.ChargeVerification) { v.ProviderFeeMinor = -1 }},
		{name: "over-rebate", edit: func(v *interfaces.ChargeVerification) { v.ProviderFeeMinor = v.AmountMinor + 1 }},
	} {
		t.Run(test.name, func(t *testing.T) {
			invalid := verification
			test.edit(&invalid)
			if services.LateChargeMatchesIntent(intent, invalid, "charge-1") {
				t.Fatal("invalid late charge must not be recorded or refunded")
			}
		})
	}
}
