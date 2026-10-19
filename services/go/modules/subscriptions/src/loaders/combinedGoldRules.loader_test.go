package loaders

import (
	"encoding/json"
	"testing"

	"zudomart/modules/subscriptions/src/models"
)

func TestCombinedGoldSettingsComeFromTheCheckmarkPricingDocument(t *testing.T) {
	defaults := models.DefaultCombinedGoldRules(2000)
	var stored struct{ combinedGoldSettings }
	raw := `{"bundleDiscountPercent":15,"multiBusinessSingleProfilePercent":6,"multiBusinessBasePercent":11,"multiBusinessStepPercent":3,"multiBusinessMaximumProfiles":4,"multiBusinessYearlyExtraPercent":7,"multiBusinessYearlyMode":"add"}`
	if err := json.Unmarshal([]byte(raw), &stored); err != nil {
		t.Fatal(err)
	}
	rules := stored.applyTo(defaults)
	if rules.SingleProfileBps != 600 || rules.BaseBps != 1100 || rules.StepBps != 300 || rules.MaximumProfiles != 4 || rules.YearlyExtraBps != 700 || rules.YearlyMode != "add" {
		t.Fatalf("admin values: %+v", rules)
	}
	var missing struct{ combinedGoldSettings }
	_ = json.Unmarshal([]byte(`{"bundleDiscountPercent":15,"multiBusinessMaximumProfiles":9,"multiBusinessYearlyMode":"sometimes"}`), &missing)
	if kept := missing.applyTo(defaults); kept != defaults || kept.YearlyMode != models.CombinedGoldYearlyReplacesStandard {
		t.Fatalf("missing or invalid values keep the defaults, yearly replaces the 20%%: %+v", kept)
	}
}
