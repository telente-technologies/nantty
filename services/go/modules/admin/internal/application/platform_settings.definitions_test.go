package application

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
	for key, definition := range platformSettingDefinitions {
		raw, _ := json.Marshal(definition.defaultValue)
		if _, err := definition.validate(raw); err != nil {
			t.Errorf("%s default invalid: %v", key, err)
		}
	}
}

func TestNormalizePermissions(t *testing.T) {
	got, err := NormalizePermissions([]string{"admin.config.write", "admin.audit.read", "admin.config.write"})
	if err != nil || len(got) != 2 || got[0] != "admin.audit.read" {
		t.Fatalf("got %v %v", got, err)
	}
	for _, bad := range []string{"", "Admin.Read", "nodots", "a.b.c.d.e", "admin.config.write; drop"} {
		if _, err := NormalizePermissions([]string{bad}); err == nil {
			t.Errorf("%q accepted", bad)
		}
	}
}
