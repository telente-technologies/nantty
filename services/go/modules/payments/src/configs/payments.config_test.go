package configs

import (
	"strings"
	"testing"

	"zudomart/modules/ledger/src/loaders"
)

func TestPaystackKeyAndFeeSettingsMustMatchTheEnvironment(t *testing.T) {
	cases := []struct {
		environment, key, mode string
		fee, business          int64
		problems               int
	}{
		{"production", "sk_live_x", "e2", 150, 100, 0},
		{"production", "sk_test_x", "e2", 150, 100, 1},
		{"production", "", "e2", 150, 100, 1},
		{"development", "sk_test_x", "e1", 150, 100, 0},
		{"development", "sk_live_x", "e2", 150, 100, 1},
		{"development", "", "e2", 150, 200, 1},
		{"development", "", "e3", 150, 100, 1},
	}
	for _, testCase := range cases {
		settings := PaymentsSettings{Money: loaders.MoneyModuleSettings{Environment: testCase.environment}, Paystack: PaystackSettings{SecretKey: testCase.key}, EscrowFeeBps: testCase.fee, BusinessEscrowFeeBps: testCase.business, EscrowMode: testCase.mode}
		if got := ProviderKeyEnvironmentMismatches(settings); len(got) != testCase.problems {
			t.Errorf("%+v: problems %v", testCase, got)
		}
	}
}

func TestPaymentsProviderFlagAcceptsOnlyKnownProviders(t *testing.T) {
	for provider, problems := range map[string]int{"": 0, "paystack": 0, "flutterwave": 0, "stripe": 1, "Paystack": 1} {
		settings := PaymentsSettings{Money: loaders.MoneyModuleSettings{Environment: "development"}, DefaultProvider: provider, EscrowFeeBps: 150, BusinessEscrowFeeBps: 100, EscrowMode: "e2"}
		settings.Flutterwave = FlutterwaveSettings{SecretKey: "FLWSECK_TEST-abc", WebhookHash: strings.Repeat("h", 32), MerchantId: "F1"}
		if got := ProviderKeyEnvironmentMismatches(settings); len(got) != problems {
			t.Errorf("provider %q: problems %v", provider, got)
		}
	}
}

func TestPlanCodesIgnoreMalformedEntries(t *testing.T) {
	plans := parsePlanProducts("premium_web:PLN_1, business_gold:PLN_2,broken")
	if len(plans) != 2 || plans["business_gold"] != "PLN_2" {
		t.Fatalf("plans = %v", plans)
	}
}

func TestFlutterwaveNeedsMatchingKeysHashAndMerchantId(t *testing.T) {
	base := PaymentsSettings{Money: loaders.MoneyModuleSettings{Environment: "development"}, DefaultProvider: "flutterwave", EscrowFeeBps: 150, BusinessEscrowFeeBps: 100, EscrowMode: "e2"}
	if got := ProviderKeyEnvironmentMismatches(base); len(got) != 3 {
		t.Fatalf("missing key, hash and merchant id must all be reported: %v", got)
	}
	base.Flutterwave = FlutterwaveSettings{SecretKey: "FLWSECK-live-key", WebhookHash: strings.Repeat("h", 32), MerchantId: "F1"}
	if got := ProviderKeyEnvironmentMismatches(base); len(got) != 1 || got[0] != "FLUTTERWAVE_SECRET_KEY_MUST_MATCH_APP_ENV" {
		t.Fatalf("a live key outside production must be refused: %v", got)
	}
	base.Flutterwave.WebhookHash = "short"
	base.Flutterwave.SecretKey = "FLWSECK_TEST-x"
	if got := ProviderKeyEnvironmentMismatches(base); len(got) != 1 {
		t.Fatalf("a short webhook hash must be refused: %v", got)
	}
}
