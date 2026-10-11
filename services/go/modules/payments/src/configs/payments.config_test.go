package configs

import (
	"strings"
	"testing"

	"zudomart/modules/ledger/src/loaders"
)

func validFlutterwave(key string) FlutterwaveSettings {
	return FlutterwaveSettings{SecretKey: key, WebhookHash: strings.Repeat("h", 32), MerchantId: "F1"}
}

func TestFlutterwaveKeyAndFeeSettingsMustMatchTheEnvironment(t *testing.T) {
	cases := []struct {
		environment, key, mode string
		fee, business          int64
		problems               int
	}{
		{"production", "FLWSECK-live", "e2", 150, 100, 0},
		{"production", "FLWSECK_TEST-x", "e2", 150, 100, 1},
		{"development", "FLWSECK_TEST-x", "e1", 150, 100, 0},
		{"development", "FLWSECK-live", "e2", 150, 100, 1},
		{"development", "FLWSECK_TEST-x", "e2", 150, 200, 1},
		{"development", "FLWSECK_TEST-x", "e3", 150, 100, 1},
	}
	for _, testCase := range cases {
		settings := PaymentsSettings{Money: loaders.MoneyModuleSettings{Environment: testCase.environment}, Flutterwave: validFlutterwave(testCase.key), EscrowFeeBps: testCase.fee, BusinessEscrowFeeBps: testCase.business, EscrowMode: testCase.mode}
		if got := ProviderKeyEnvironmentMismatches(settings); len(got) != testCase.problems {
			t.Errorf("%+v: problems %v", testCase, got)
		}
	}
}

func TestPaymentsProviderFlagAcceptsOnlyFlutterwave(t *testing.T) {
	for provider, problems := range map[string]int{"": 0, "flutterwave": 0, "stripe": 1, "legacy": 1, "Flutterwave": 1} {
		settings := PaymentsSettings{Money: loaders.MoneyModuleSettings{Environment: "development"}, DefaultProvider: provider, EscrowFeeBps: 150, BusinessEscrowFeeBps: 100, EscrowMode: "e2", Flutterwave: validFlutterwave("FLWSECK_TEST-abc")}
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

func TestProductionRefusesToStartWithoutFlutterwaveSecrets(t *testing.T) {
	production := PaymentsSettings{Money: loaders.MoneyModuleSettings{Environment: "production"}, DefaultProvider: "flutterwave", EscrowFeeBps: 150, BusinessEscrowFeeBps: 100, EscrowMode: "e2"}
	got := ProviderKeyEnvironmentMismatches(production)
	if strings.Join(got, ",") != "FLUTTERWAVE_SECRET_KEY,FLUTTERWAVE_WEBHOOK_HASH_AT_LEAST_32_CHARACTERS,FLUTTERWAVE_MERCHANT_ID" {
		t.Fatalf("missing key, hash and merchant id must all be reported in production: %v", got)
	}
	development := production
	development.Money.Environment = "development"
	if got := ProviderKeyEnvironmentMismatches(development); len(got) != 0 {
		t.Fatalf("local development may run without Flutterwave keys: %v", got)
	}
}

func TestFlutterwaveNeedsMatchingKeysHashAndMerchantIdOnceAKeyIsSet(t *testing.T) {
	base := PaymentsSettings{Money: loaders.MoneyModuleSettings{Environment: "development"}, DefaultProvider: "flutterwave", EscrowFeeBps: 150, BusinessEscrowFeeBps: 100, EscrowMode: "e2"}
	base.Flutterwave = FlutterwaveSettings{SecretKey: "FLWSECK_TEST-x"}
	if got := ProviderKeyEnvironmentMismatches(base); len(got) != 2 {
		t.Fatalf("a key without hash and merchant id must be refused: %v", got)
	}
	base.Flutterwave = validFlutterwave("FLWSECK-live-key")
	if got := ProviderKeyEnvironmentMismatches(base); len(got) != 1 || got[0] != "FLUTTERWAVE_SECRET_KEY_MUST_MATCH_APP_ENV" {
		t.Fatalf("a live key outside production must be refused: %v", got)
	}
	base.Flutterwave = validFlutterwave("FLWSECK_TEST-x")
	base.Flutterwave.WebhookHash = "short"
	if got := ProviderKeyEnvironmentMismatches(base); len(got) != 1 {
		t.Fatalf("a short webhook hash must be refused: %v", got)
	}
}
