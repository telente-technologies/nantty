package configs

import (
	"testing"

	"zudomart/modules/ledger/src/loaders"
)

func TestBachsKeysAndBaseUrlMustMatchTheEnvironment(t *testing.T) {
	cases := []struct {
		environment string
		key         string
		baseUrl     string
		secrets     []string
		problems    int
	}{
		{"production", "sk_live_x", BachsProductionBaseUrl, []string{"whsec"}, 0},
		{"production", "sk_sandbox_x", BachsProductionBaseUrl, []string{"whsec"}, 1},
		{"production", "sk_live_x", BachsSandboxBaseUrl, []string{"whsec"}, 1},
		{"development", "sk_sandbox_x", BachsSandboxBaseUrl, []string{"whsec"}, 0},
		{"development", "sk_live_x", BachsProductionBaseUrl, []string{"whsec"}, 2},
		{"development", "sk_sandbox_x", BachsSandboxBaseUrl, nil, 1},
		{"development", "", BachsSandboxBaseUrl, nil, 0},
	}
	for _, testCase := range cases {
		settings := PaymentsSettings{Money: loaders.MoneyModuleSettings{Environment: testCase.environment}, BachsSecretKey: testCase.key, BachsBaseUrl: testCase.baseUrl, BachsWebhookSigningSecrets: testCase.secrets, PlatformCommissionBps: 500}
		if got := ProviderKeyEnvironmentMismatches(settings); len(got) != testCase.problems {
			t.Errorf("%+v: problems %v", testCase, got)
		}
	}
}

func TestPayoutFeeOverridesAndPlanProductsIgnoreMalformedEntries(t *testing.T) {
	overrides := parseCurrencyAmountOverrides("ngn:5000, usd:250,bad,KES:-1,GHS:x")
	if len(overrides) != 2 || overrides["NGN"] != 5000 || overrides["USD"] != 250 {
		t.Fatalf("overrides = %v", overrides)
	}
	plans := parsePlanProducts("premium_web:prod_1, business_gold:prod_2,broken")
	if len(plans) != 2 || plans["business_gold"] != "prod_2" {
		t.Fatalf("plans = %v", plans)
	}
}
