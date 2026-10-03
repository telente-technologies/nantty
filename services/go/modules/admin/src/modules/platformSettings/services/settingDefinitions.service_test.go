package services

import (
	"encoding/json"
	"testing"
)

func TestGiftShareTierValidation(t *testing.T) {
	cases := []struct {
		name  string
		input string
		valid bool
	}{
		{"defaults style", `{"tiers":[{"minimumMonthlyGiftCoins":0,"creatorShareBps":5000},{"minimumMonthlyGiftCoins":100,"creatorShareBps":7000}]}`, true},
		{"share above cap", `{"tiers":[{"minimumMonthlyGiftCoins":0,"creatorShareBps":7001}]}`, false},
		{"negative share", `{"tiers":[{"minimumMonthlyGiftCoins":0,"creatorShareBps":-1}]}`, false},
		{"first tier not zero", `{"tiers":[{"minimumMonthlyGiftCoins":10,"creatorShareBps":5000}]}`, false},
		{"not ascending", `{"tiers":[{"minimumMonthlyGiftCoins":0,"creatorShareBps":5000},{"minimumMonthlyGiftCoins":0,"creatorShareBps":6000}]}`, false},
		{"empty", `{"tiers":[]}`, false},
		{"unknown field", `{"tiers":[{"minimumMonthlyGiftCoins":0,"creatorShareBps":5000,"bonus":1}]}`, false},
		{"trailing data", `{"tiers":[{"minimumMonthlyGiftCoins":0,"creatorShareBps":5000}]} {}`, false},
	}
	for _, testCase := range cases {
		_, err := validateGiftShareTiers(json.RawMessage(testCase.input))
		if (err == nil) != testCase.valid {
			t.Errorf("%s: err=%v", testCase.name, err)
		}
	}
}

func TestCreatorRequirementsAndMonetizationValidation(t *testing.T) {
	if _, err := validateCreatorRequirements(json.RawMessage(`{"minimumFollowers":10,"minimumAccountAgeDays":1,"minimumOriginalPosts":1,"maximumRecentStrikes":0,"strikeLookbackDays":30,"requireVerifiedEmail":false}`)); err != nil {
		t.Errorf("valid requirements rejected: %v", err)
	}
	for name, input := range map[string]string{
		"negative followers": `{"minimumFollowers":-1,"strikeLookbackDays":30}`,
		"zero lookback":      `{"minimumFollowers":1,"strikeLookbackDays":0}`,
		"unknown field":      `{"minimumFollowers":1,"strikeLookbackDays":30,"vip":true}`,
		"wrong type":         `{"minimumFollowers":"many","strikeLookbackDays":30}`,
	} {
		if _, err := validateCreatorRequirements(json.RawMessage(input)); err == nil {
			t.Errorf("%s accepted", name)
		}
	}
	policy := map[string]string{
		"valid":        `{"rows":[{"id":"original","label":"Original","multiplierBps":10000,"active":true}]}`,
		"duplicate id": `{"rows":[{"id":"a1","label":"A","multiplierBps":1,"active":true},{"id":"a1","label":"B","multiplierBps":1,"active":true}]}`,
		"bad id":       `{"rows":[{"id":"Bad Id","label":"A","multiplierBps":1,"active":true}]}`,
		"too large":    `{"rows":[{"id":"ok","label":"A","multiplierBps":30001,"active":true}]}`,
	}
	for name, input := range policy {
		_, err := validateMonetizationPolicy(json.RawMessage(input))
		if (err == nil) != (name == "valid") {
			t.Errorf("%s: err=%v", name, err)
		}
	}
}

func TestEveryDefaultSettingPassesItsOwnValidator(t *testing.T) {
	for key, definition := range PlatformSettingDefinitions {
		raw, _ := json.Marshal(definition.DefaultValue)
		if _, err := definition.Validate(raw); err != nil {
			t.Errorf("%s default invalid: %v", key, err)
		}
	}
}

func TestDefaultAiGeneratedMultiplierIsThirtyPercentOfTheNormalCreatorShare(t *testing.T) {
	policy := PlatformSettingDefinitions[MonetizationPolicyKey].DefaultValue.(MonetizationPolicy)
	for _, row := range policy.Rows {
		want := map[string]int{"original": 10000, "ai_generated": 3000}[row.Id]
		if row.MultiplierBps != want {
			t.Fatalf("%s multiplier is %d, want %d", row.Id, row.MultiplierBps, want)
		}
	}
}
