package configs_test

import (
	"testing"

	"nantty/modules/payments/src/configs"
	"nantty/platform/config"
)

func TestPlanCodesIgnoreMalformedEntries(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("PAYMENT_PLAN_CODES", "premium_web:PLN_1, business_gold:PLN_2,broken")
	settings := configs.ReadPaymentsSettingsFromEnvironment(config.NewEnvironmentReader())
	plans := settings.WebSubscriptionPlanProducts
	if len(plans) != 2 || plans["business_gold"] != "PLN_2" {
		t.Fatalf("configured plans = %v", plans)
	}
}
