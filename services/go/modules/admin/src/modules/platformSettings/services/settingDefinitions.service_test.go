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

func TestPlansDocumentMatchesWhatMoneyReads(t *testing.T) {
	definition := PlatformSettingDefinitions[PlansKey]
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
			IsPurchasable         bool              `json:"isPurchasable"`
			DashboardEntitlements []json.RawMessage `json:"dashboardEntitlements"`
		} `json:"plans"`
	}
	_ = json.Unmarshal(raw, &document)
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
	purchasableBlack := []byte(`{"supportedCurrencies":["NGN"],"plans":[{"planKey":"BLACK_OFFICIAL","color":"BLACK","tier":"OFFICIAL","displayName":"Black","badgeVisible":true,"isPurchasable":true,"perks":[],"dashboardEntitlements":[]}]}`)
	if _, err := definition.Validate(purchasableBlack); err == nil {
		t.Fatal("Black Official can never be purchasable")
	}
	wrongTier := []byte(`{"supportedCurrencies":["NGN"],"plans":[{"planKey":"BLUE_PRO","color":"BLUE","tier":"PRO","displayName":"Blue Pro","badgeVisible":true,"isPurchasable":true,"perks":[],"dashboardEntitlements":[]}]}`)
	if _, err := definition.Validate(wrongTier); err == nil {
		t.Fatal("tiers must match the color")
	}
}

func TestDocumentDefaultsMirrorWhatMoneyAndUsersEnforceToday(t *testing.T) {
	revenue := defaultRevenueRules()
	if revenue.CoinTransferFeeBasisPoints != 2500 || revenue.CreatorAdShareBasisPoints != 4000 || revenue.EscrowFee.DefaultBasisPoints != 150 || revenue.EscrowFee.BusinessPlanBasisPoints != 100 {
		t.Fatalf("revenue defaults drifted from COIN_TRANSFER_FEE_BPS, ADS_REVENUE_CREATOR_SHARE_BPS and ESCROW_FEE_*: %+v", revenue)
	}
	if len(revenue.CoinUnitValues) != 7 || revenue.CoinUnitValues[0] != (MoneyValue{AmountMinor: 1000, Currency: "NGN"}) {
		t.Fatalf("coin unit values must equal COIN_CASH_VALUES: %v", revenue.CoinUnitValues)
	}
	usernames := defaultUsernameRules()
	if usernames.ReleasedUsernameCooldownDays != 120 || usernames.ChangeWindowDays != 30 || usernames.MinimumLength != 3 || usernames.MaximumLength != 30 || usernames.MustStartWithLetter {
		t.Fatalf("username defaults drifted from the users module: %+v", usernames)
	}
	for key, value := range map[string]any{RevenueRulesKey: revenue, UsernameRulesKey: usernames, CreatorEligibilityKey: defaultCreatorEligibility()} {
		raw, _ := json.Marshal(value)
		if _, err := PlatformSettingDefinitions[key].Validate(raw); err != nil {
			t.Errorf("%s default must validate: %v", key, err)
		}
	}
}
