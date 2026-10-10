package models

import "testing"

func TestVerificationLevelsFollowTheOwnerApprovedRules(t *testing.T) {
	cases := []struct {
		name     string
		inputs   VerificationInputs
		level    int
		nextStep string
		method   string
	}{
		{"email only", VerificationInputs{Country: "NG", ValidationMode: CustomerValidationRequired}, 0, "payout_setup", ""},
		{"payout account but no bank validation", VerificationInputs{Country: "NG", PayoutAccountReady: true, ValidationMode: CustomerValidationRequired}, 0, "bank_validation", ""},
		{"bank validation without a payout account", VerificationInputs{Country: "NG", BankAccountValidated: true, ValidationMode: CustomerValidationRequired}, 0, "payout_setup", ""},
		{"payout-verified in Nigeria", VerificationInputs{Country: "NG", PayoutAccountReady: true, BankAccountValidated: true, ValidationMode: CustomerValidationRequired}, 1, "identity_check", "bank_account"},
		{"validation switched off", VerificationInputs{Country: "NG", PayoutAccountReady: true, ValidationMode: CustomerValidationOff}, 1, "identity_check", "payout_account"},
		{"unknown country counts as Nigeria", VerificationInputs{PayoutAccountReady: true, BankAccountValidated: true, ValidationMode: CustomerValidationRequired}, 1, "identity_check", "bank_account"},
		{"identity-verified in Nigeria", VerificationInputs{Country: "NG", PayoutAccountReady: true, BankAccountValidated: true, IdentityVerified: true, ValidationMode: CustomerValidationRequired}, 2, "", "bank_account"},
		{"Smile ID alone is not L1 in Nigeria", VerificationInputs{Country: "NG", IdentityVerified: true, ValidationMode: CustomerValidationRequired}, 0, "payout_setup", ""},
		{"Smile ID outside Nigeria", VerificationInputs{Country: "GH", IdentityVerified: true}, 2, "", "smile_id"},
		{"unverified outside Nigeria", VerificationInputs{Country: "KE", PayoutAccountReady: true}, 0, "identity_check", ""},
	}
	for _, testCase := range cases {
		view := BuildVerificationLevel(testCase.inputs)
		nextStep, method := "", ""
		if view.NextStep != nil {
			nextStep = *view.NextStep
		}
		if view.Method != nil {
			method = *view.Method
		}
		if view.Level != testCase.level || nextStep != testCase.nextStep || method != testCase.method {
			t.Errorf("%s: level %d next %q method %q", testCase.name, view.Level, nextStep, method)
		}
		if view.Unlocks.Ads != (view.Level >= 1) || view.Unlocks.Withdrawals != (view.Level >= 1) || view.Unlocks.Checkmarks != (view.Level == 2) {
			t.Errorf("%s: unlocks %+v do not match level %d", testCase.name, view.Unlocks, view.Level)
		}
	}
}
