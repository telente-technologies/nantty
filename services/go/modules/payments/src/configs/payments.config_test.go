package configs

import (
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

func TestPlanCodesIgnoreMalformedEntries(t *testing.T) {
	plans := parsePlanProducts("premium_web:PLN_1, business_gold:PLN_2,broken")
	if len(plans) != 2 || plans["business_gold"] != "PLN_2" {
		t.Fatalf("plans = %v", plans)
	}
}
