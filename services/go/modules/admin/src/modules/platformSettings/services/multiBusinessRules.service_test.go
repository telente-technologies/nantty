package services

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestCheckmarkPricingCarriesTheMultiBusinessRules(t *testing.T) {
	stored, err := validateCheckmarkPricing(json.RawMessage(`{"bundleDiscountPercent":15,"bundleMaximumBusinesses":3,"blackGraceDays":14}`))
	if err != nil {
		t.Fatalf("documents saved before the multi-business rules still validate: %v", err)
	}
	if strings.Contains(string(stored), "multiBusiness") {
		t.Fatalf("absent rules stay absent so the defaults apply: %s", stored)
	}
	full := `{"bundleDiscountPercent":15,"bundleMaximumBusinesses":3,"blackGraceDays":14,"multiBusinessSingleProfilePercent":5,"multiBusinessBasePercent":10,"multiBusinessStepPercent":2,"multiBusinessMaximumProfiles":5,"multiBusinessYearlyExtraPercent":5,"multiBusinessYearlyMode":"replace"}`
	if _, err := validateCheckmarkPricing(json.RawMessage(full)); err != nil {
		t.Fatal(err)
	}
	for _, broken := range []string{
		strings.Replace(full, `"replace"`, `"sometimes"`, 1),
		strings.Replace(full, `"multiBusinessMaximumProfiles":5`, `"multiBusinessMaximumProfiles":6`, 1),
		strings.Replace(full, `"multiBusinessBasePercent":10`, `"multiBusinessBasePercent":95`, 1),
		strings.Replace(full, `"multiBusinessStepPercent":2`, `"multiBusinessStepPercent":40`, 1),
	} {
		if _, err := validateCheckmarkPricing(json.RawMessage(broken)); err == nil {
			t.Fatalf("accepted %s", broken)
		}
	}
	defaults := PlatformSettingDefinitions[CheckmarkPricingKey].DefaultValue.(CheckmarkPricingRules)
	if *defaults.MultiBusinessYearlyMode != "replace" || *defaults.MultiBusinessMaximumProfiles != 5 {
		t.Fatalf("defaults: %+v", defaults)
	}
}
