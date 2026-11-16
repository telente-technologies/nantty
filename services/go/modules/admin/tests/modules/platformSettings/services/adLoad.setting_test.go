package services_test

import (
	"encoding/json"
	"strings"
	"testing"

	"nantty/modules/admin/src/modules/platformSettings/services"
)

func plansDocumentWith(t *testing.T, mutate func(*services.PlansConfiguration)) json.RawMessage {
	t.Helper()
	defaults := services.PlatformSettingDefinitions[services.PlansKey].DefaultValue.(services.PlansConfiguration)
	encodedDefaults, err := json.Marshal(defaults)
	if err != nil {
		t.Fatal(err)
	}
	var value services.PlansConfiguration
	if err := json.Unmarshal(encodedDefaults, &value); err != nil {
		t.Fatal(err)
	}
	mutate(&value)
	encoded, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return encoded
}

func setPlanAdLoad(planKey string, percent int) func(*services.PlansConfiguration) {
	return func(value *services.PlansConfiguration) {
		for index := range value.Plans {
			if value.Plans[index].PlanKey == planKey {
				value.Plans[index].AdLoadPercent = &percent
			}
		}
	}
}

func TestDefaultPlansCarryTheOwnerAdLoadDefaults(t *testing.T) {
	value := services.PlatformSettingDefinitions[services.PlansKey].DefaultValue.(services.PlansConfiguration)
	if value.FreeAdLoadPercent == nil || *value.FreeAdLoadPercent != 100 {
		t.Fatalf("free users get the full ad load: %v", value.FreeAdLoadPercent)
	}
	want := map[string]int{"BLUE_ESSENTIAL": 75, "BLUE_VERIFIED": 60, "BLUE_PREMIUM": 0, "GOLD_ONLY": 50, "GOLD_PRO": 50, "GOLD_BUSINESS": 0, "BLACK_OFFICIAL": 20}
	for _, plan := range value.Plans {
		if plan.AdLoadPercent == nil || *plan.AdLoadPercent != want[plan.PlanKey] {
			t.Errorf("%s ad load = %v, want %d", plan.PlanKey, plan.AdLoadPercent, want[plan.PlanKey])
		}
	}
	if _, err := services.PlatformSettingDefinitions[services.PlansKey].Validate(plansDocumentWith(t, func(*services.PlansConfiguration) {})); err != nil {
		t.Fatalf("defaults must validate: %v", err)
	}
}

func TestAdFreePlansCannotBeGivenAds(t *testing.T) {
	for _, planKey := range []string{"BLUE_PREMIUM", "GOLD_BUSINESS"} {
		_, err := services.PlatformSettingDefinitions[services.PlansKey].Validate(plansDocumentWith(t, setPlanAdLoad(planKey, 10)))
		if err == nil || !strings.Contains(err.Error(), "locked at 0%") {
			t.Errorf("%s above 0 must be refused: %v", planKey, err)
		}
	}
}

func TestPlanAdLoadRange(t *testing.T) {
	cases := map[string]struct {
		mutate func(*services.PlansConfiguration)
		valid  bool
	}{
		"black lowered to 5":   {setPlanAdLoad("BLACK_OFFICIAL", 5), true},
		"gold pro at 100":      {setPlanAdLoad("GOLD_PRO", 100), true},
		"essential above 100":  {setPlanAdLoad("BLUE_ESSENTIAL", 101), false},
		"verified negative":    {setPlanAdLoad("BLUE_VERIFIED", -1), false},
		"free above 100":       {func(value *services.PlansConfiguration) { over := 120; value.FreeAdLoadPercent = &over }, false},
		"legacy without loads": {func(value *services.PlansConfiguration) { value.FreeAdLoadPercent = nil; setPlanAdLoadNil(value) }, true},
	}
	for name, testCase := range cases {
		_, err := services.PlatformSettingDefinitions[services.PlansKey].Validate(plansDocumentWith(t, testCase.mutate))
		if (err == nil) != testCase.valid {
			t.Errorf("%s: err=%v", name, err)
		}
	}
}

func setPlanAdLoadNil(value *services.PlansConfiguration) {
	for index := range value.Plans {
		value.Plans[index].AdLoadPercent = nil
	}
}
