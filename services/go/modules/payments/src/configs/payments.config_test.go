package configs

import (
	"testing"

	"zudomart/modules/ledger/src/loaders"
)

func TestProviderKeysMustMatchTheEnvironment(t *testing.T) {
	cases := []struct {
		environment string
		paystack    string
		flutterwave string
		problems    int
	}{
		{"production", "sk_live_x", "FLWSECK-x", 0},
		{"production", "sk_test_x", "FLWSECK-x", 1},
		{"production", "sk_live_x", "FLWSECK_TEST-x", 1},
		{"development", "sk_test_x", "FLWSECK_TEST-x", 0},
		{"development", "sk_live_x", "FLWSECK-x", 2},
		{"development", "", "", 0},
	}
	for _, testCase := range cases {
		settings := PaymentsSettings{Money: loaders.MoneyModuleSettings{Environment: testCase.environment}, PaystackSecretKey: testCase.paystack, FlutterwaveSecretKey: testCase.flutterwave}
		if got := ProviderKeyEnvironmentMismatches(settings); len(got) != testCase.problems {
			t.Errorf("%+v: problems %v", testCase, got)
		}
	}
}

func TestTransferFeeOverridesIgnoreMalformedEntries(t *testing.T) {
	overrides := parseTransferFeeOverrides("paystack:ngn:5000, flutterwave:GHS:120,bad,paystack:KES:-1,paystack:USD:x")
	if len(overrides) != 2 || overrides["paystack:NGN"] != 5000 || overrides["flutterwave:GHS"] != 120 {
		t.Fatalf("overrides = %v", overrides)
	}
}
