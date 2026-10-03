package services

import (
	"context"
	"encoding/json"

	"zudomart/platform/identityports"
)

type SuggestionRules struct {
	Blue struct {
		RequiresIdVerified    bool `json:"requiresIdVerified"`
		MinimumAccountAgeDays int  `json:"minimumAccountAgeDays"`
		MinimumRealFollowers  int  `json:"minimumRealFollowers"`
		NoViolationsInDays    int  `json:"noViolationsInDays"`
	} `json:"blue"`
	Gold struct {
		RequiresBusinessVerification   bool `json:"requiresBusinessVerification"`
		RequiresActiveStoreOrBrandPage bool `json:"requiresActiveStoreOrBrandPage"`
		MinimumCompletedOrders         int  `json:"minimumCompletedOrders"`
		MinimumSuccessRatePercent      int  `json:"minimumSuccessRatePercent"`
	} `json:"gold"`
}

type MoneyAmount struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

type PricingRules struct {
	BlackGraceDays       int         `json:"blackGraceDays"`
	BlueMonthlyPrice     MoneyAmount `json:"blueMonthlyPrice"`
	GoldOnlyMonthlyPrice MoneyAmount `json:"goldOnlyMonthlyPrice"`
}

func LoadSuggestionRules(ctx context.Context) SuggestionRules {
	rules := SuggestionRules{}
	rules.Blue.RequiresIdVerified, rules.Blue.MinimumAccountAgeDays, rules.Blue.MinimumRealFollowers, rules.Blue.NoViolationsInDays = true, 90, 1000, 90
	rules.Gold.RequiresBusinessVerification, rules.Gold.RequiresActiveStoreOrBrandPage, rules.Gold.MinimumCompletedOrders, rules.Gold.MinimumSuccessRatePercent = true, true, 20, 90
	readSetting(ctx, "checkmark-suggestions", &rules)
	return rules
}

func LoadPricingRules(ctx context.Context) PricingRules {
	rules := PricingRules{BlackGraceDays: 14, BlueMonthlyPrice: MoneyAmount{AmountMinor: 250000, Currency: "NGN"}, GoldOnlyMonthlyPrice: MoneyAmount{AmountMinor: 300000, Currency: "NGN"}}
	readSetting(ctx, "checkmark-pricing", &rules)
	return rules
}

func readSetting(ctx context.Context, key string, destination any) {
	settings, err := identityports.Default.PlatformSettings()
	if err != nil {
		return
	}
	if raw, _, err := settings.ReadSettingValue(ctx, key); err == nil {
		_ = json.Unmarshal(raw, destination)
	}
}
