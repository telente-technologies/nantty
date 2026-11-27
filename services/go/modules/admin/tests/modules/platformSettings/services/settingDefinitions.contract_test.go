package services_test

import (
	"encoding/json"
	"testing"

	"nantty/modules/admin/src/modules/platformSettings/services"
)

func TestGiftShareTierValidation(t *testing.T) {
	validate := services.PlatformSettingDefinitions[services.GiftShareTiersKey].Validate
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
		t.Run(testCase.name, func(t *testing.T) {
			_, err := validate(json.RawMessage(testCase.input))
			if (err == nil) != testCase.valid {
				t.Errorf("err=%v", err)
			}
		})
	}
}

func TestCreatorRequirementsAndMonetizationValidation(t *testing.T) {
	creatorValidator := services.PlatformSettingDefinitions[services.CreatorRequirementsKey].Validate
	if _, err := creatorValidator(json.RawMessage(`{"minimumFollowers":10000,"minimumVerifiedFollowers":500,"minimumQualifyingImpressionsLast30Days":100000,"minimumAccountAgeDays":30,"minimumOriginalPosts":10,"minimumOriginalPostsInLast60Days":10,"maximumRecentStrikes":0,"strikeLookbackDays":90,"requireVerifiedEmail":true,"requiresIdentityVerification":true}`)); err != nil {
		t.Errorf("valid requirements rejected: %v", err)
	}
	for name, input := range map[string]string{
		"followers below policy":          `{"minimumFollowers":9999,"minimumVerifiedFollowers":500,"minimumQualifyingImpressionsLast30Days":100000,"minimumAccountAgeDays":30,"minimumOriginalPosts":10,"minimumOriginalPostsInLast60Days":10,"maximumRecentStrikes":0,"strikeLookbackDays":90,"requireVerifiedEmail":true}`,
		"verified followers below policy": `{"minimumFollowers":10000,"minimumVerifiedFollowers":499,"minimumQualifyingImpressionsLast30Days":100000,"minimumAccountAgeDays":30,"minimumOriginalPosts":10,"minimumOriginalPostsInLast60Days":10,"maximumRecentStrikes":0,"strikeLookbackDays":90,"requireVerifiedEmail":true}`,
		"impressions below policy":        `{"minimumFollowers":10000,"minimumVerifiedFollowers":500,"minimumQualifyingImpressionsLast30Days":99999,"minimumAccountAgeDays":30,"minimumOriginalPosts":10,"minimumOriginalPostsInLast60Days":10,"maximumRecentStrikes":0,"strikeLookbackDays":90,"requireVerifiedEmail":true}`,
		"account age below policy":        `{"minimumFollowers":10000,"minimumVerifiedFollowers":500,"minimumQualifyingImpressionsLast30Days":100000,"minimumAccountAgeDays":29,"minimumOriginalPosts":10,"minimumOriginalPostsInLast60Days":10,"maximumRecentStrikes":0,"strikeLookbackDays":90,"requireVerifiedEmail":true}`,
		"posts below policy":              `{"minimumFollowers":10000,"minimumVerifiedFollowers":500,"minimumQualifyingImpressionsLast30Days":100000,"minimumAccountAgeDays":30,"minimumOriginalPosts":9,"minimumOriginalPostsInLast60Days":9,"maximumRecentStrikes":0,"strikeLookbackDays":90,"requireVerifiedEmail":true}`,
		"strikes allowed":                 `{"minimumFollowers":10000,"minimumVerifiedFollowers":500,"minimumQualifyingImpressionsLast30Days":100000,"minimumAccountAgeDays":30,"minimumOriginalPosts":10,"minimumOriginalPostsInLast60Days":10,"maximumRecentStrikes":1,"strikeLookbackDays":90,"requireVerifiedEmail":true}`,
		"lookback below policy":           `{"minimumFollowers":10000,"minimumVerifiedFollowers":500,"minimumQualifyingImpressionsLast30Days":100000,"minimumAccountAgeDays":30,"minimumOriginalPosts":10,"minimumOriginalPostsInLast60Days":10,"maximumRecentStrikes":0,"strikeLookbackDays":89,"requireVerifiedEmail":true}`,
		"verified email required":         `{"minimumFollowers":10000,"minimumVerifiedFollowers":500,"minimumQualifyingImpressionsLast30Days":100000,"minimumAccountAgeDays":30,"minimumOriginalPosts":10,"minimumOriginalPostsInLast60Days":10,"maximumRecentStrikes":0,"strikeLookbackDays":90,"requireVerifiedEmail":false}`,
		"inconsistent post aliases":       `{"minimumFollowers":10000,"minimumVerifiedFollowers":500,"minimumQualifyingImpressionsLast30Days":100000,"minimumAccountAgeDays":30,"minimumOriginalPosts":10,"minimumOriginalPostsInLast60Days":11,"maximumRecentStrikes":0,"strikeLookbackDays":90,"requireVerifiedEmail":true}`,
		"unknown field":                   `{"minimumFollowers":10000,"minimumVerifiedFollowers":500,"minimumQualifyingImpressionsLast30Days":100000,"minimumAccountAgeDays":30,"minimumOriginalPosts":10,"minimumOriginalPostsInLast60Days":10,"maximumRecentStrikes":0,"strikeLookbackDays":90,"requireVerifiedEmail":true,"vip":true}`,
		"wrong type":                      `{"minimumFollowers":"many","minimumVerifiedFollowers":500,"minimumQualifyingImpressionsLast30Days":100000,"minimumAccountAgeDays":30,"minimumOriginalPosts":10,"minimumOriginalPostsInLast60Days":10,"maximumRecentStrikes":0,"strikeLookbackDays":90,"requireVerifiedEmail":true}`,
	} {
		if _, err := creatorValidator(json.RawMessage(input)); err == nil {
			t.Errorf("%s accepted", name)
		}
	}
	monetizationValidator := services.PlatformSettingDefinitions[services.MonetizationPolicyKey].Validate
	policy := map[string]string{
		"valid":        `{"rows":[{"id":"original","label":"Original","multiplierBps":10000,"active":true}]}`,
		"duplicate id": `{"rows":[{"id":"a1","label":"A","multiplierBps":1,"active":true},{"id":"a1","label":"B","multiplierBps":1,"active":true}]}`,
		"bad id":       `{"rows":[{"id":"Bad Id","label":"A","multiplierBps":1,"active":true}]}`,
		"too large":    `{"rows":[{"id":"ok","label":"A","multiplierBps":30001,"active":true}]}`,
	}
	for name, input := range policy {
		_, err := monetizationValidator(json.RawMessage(input))
		if (err == nil) != (name == "valid") {
			t.Errorf("%s: err=%v", name, err)
		}
	}
}

func TestEveryDefaultSettingPassesItsOwnValidator(t *testing.T) {
	for key, definition := range services.PlatformSettingDefinitions {
		raw, _ := json.Marshal(definition.DefaultValue)
		if _, err := definition.Validate(raw); err != nil {
			t.Errorf("%s default invalid: %v", key, err)
		}
	}
}

func TestDefaultAiGeneratedMultiplierIsThirtyPercentOfTheNormalCreatorShare(t *testing.T) {
	policy := services.PlatformSettingDefinitions[services.MonetizationPolicyKey].DefaultValue.(services.MonetizationPolicy)
	for _, row := range policy.Rows {
		want := map[string]int{"original": 10000, "ai_generated": 3000}[row.Id]
		if row.MultiplierBps != want {
			t.Fatalf("%s multiplier is %d, want %d", row.Id, row.MultiplierBps, want)
		}
	}
}

func TestPlansDocumentMatchesWhatMoneyReads(t *testing.T) {
	definition := services.PlatformSettingDefinitions[services.PlansKey]
	if definition.WritePermission != "config:plans" {
		t.Fatalf("plans are edited with config:plans, got %q", definition.WritePermission)
	}
	raw, _ := json.Marshal(definition.DefaultValue)
	if _, err := definition.Validate(raw); err != nil {
		t.Fatalf("the default plans document must validate: %v", err)
	}
	var document struct {
		Plans []struct {
			PlanKey               string            `json:"planKey"`
			DashboardEntitlements []json.RawMessage `json:"dashboardEntitlements"`
		} `json:"plans"`
	}
	if err := json.Unmarshal(raw, &document); err != nil {
		t.Fatal(err)
	}
	keys := map[string]int{}
	for _, plan := range document.Plans {
		keys[plan.PlanKey] = len(plan.DashboardEntitlements)
	}
	for _, key := range []string{"BLUE_ESSENTIAL", "BLUE_VERIFIED", "BLUE_PREMIUM", "GOLD_ONLY", "GOLD_PRO", "GOLD_BUSINESS", "BLACK_OFFICIAL"} {
		if _, found := keys[key]; !found {
			t.Errorf("missing plan %s", key)
		}
	}
	if keys["GOLD_PRO"] == 0 || keys["GOLD_BUSINESS"] == 0 {
		t.Fatal("seller plans keep their dashboard entitlements")
	}
	for name, invalid := range map[string]string{
		"purchasable Black Official": `{"supportedCurrencies":["NGN"],"plans":[{"planKey":"BLACK_OFFICIAL","color":"BLACK","tier":"OFFICIAL","displayName":"Black","badgeVisible":true,"isPurchasable":true,"perks":[],"dashboardEntitlements":[]}]}`,
		"mismatched tier":            `{"supportedCurrencies":["NGN"],"plans":[{"planKey":"BLUE_PRO","color":"BLUE","tier":"PRO","displayName":"Blue Pro","badgeVisible":true,"isPurchasable":true,"perks":[],"dashboardEntitlements":[]}]}`,
	} {
		if _, err := definition.Validate([]byte(invalid)); err == nil {
			t.Errorf("%s document unexpectedly validated", name)
		}
	}
}
