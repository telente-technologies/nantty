package services

import (
	"context"
	"encoding/json"

	"nantty/platform/identityports"
	"nantty/platform/regionpricing"
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
	BlackGraceDays int `json:"blackGraceDays"`
}

func SuggestedCheckmarkPrice(color string, countryCode string) MoneyAmount {
	region, _ := regionpricing.RegionForCountry(countryCode)
	planCode := "blue"
	if color == "gold" {
		planCode = "gold_only"
	}
	price, _ := regionpricing.FindDefaultPlanPrice(planCode, region.Code)
	return MoneyAmount{AmountMinor: price.WebMonthlyMinor, Currency: price.Currency}
}

func LoadSuggestionRules(ctx context.Context) SuggestionRules {
	rules := SuggestionRules{}
	rules.Blue.RequiresIdVerified, rules.Blue.MinimumAccountAgeDays, rules.Blue.MinimumRealFollowers, rules.Blue.NoViolationsInDays = true, 90, 1000, 90
	rules.Gold.RequiresBusinessVerification, rules.Gold.RequiresActiveStoreOrBrandPage, rules.Gold.MinimumCompletedOrders, rules.Gold.MinimumSuccessRatePercent = true, true, 20, 90
	readSetting(ctx, "checkmark-suggestions", &rules)
	return rules
}

func LoadPricingRules(ctx context.Context) PricingRules {
	rules := PricingRules{BlackGraceDays: 0}
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
