package loaders

import (
	"context"
	"encoding/json"

	ledgerloaders "zudomart/modules/ledger/src/loaders"
	"zudomart/modules/subscriptions/src/constants"
	"zudomart/modules/subscriptions/src/models"
)

type CheckmarkPricing struct {
	Pricing        models.PricingRules
	BlackGraceDays int
}

func ReadTrialRules(ctx context.Context, source *ledgerloaders.PlatformSettingsSource) (models.TrialRules, int64) {
	rules := models.TrialRules{TrialDays: 7, MinimumAccountAgeDays: 7, RequiresVerifiedEmail: true, OnePerPerson: true, OnePerCard: true, OnePerDevice: true, MaximumRiskScore: 50}
	yearlyBps := int64(2000)
	raw, found := source.ReadValue(ctx, constants.TrialRulesSettingKey)
	if !found {
		return rules, yearlyBps
	}
	var stored struct {
		TrialLength            string `json:"trialLength"`
		YearlyDiscountPercent  *int   `json:"yearlyDiscountPercent"`
		MinimumAccountAgeDays  int    `json:"minimumAccountAgeDays"`
		RequiresVerifiedEmail  bool   `json:"requiresVerifiedEmail"`
		OnePerPerson           bool   `json:"onePerPerson"`
		OnePerCard             bool   `json:"onePerCard"`
		OnePerDevice           bool   `json:"onePerDevice"`
		MaximumRiskScore       int    `json:"maximumRiskScore"`
		MinimumCompletedOrders int    `json:"minimumCompletedOrders"`
	}
	if json.Unmarshal(raw, &stored) != nil {
		return rules, yearlyBps
	}
	if stored.YearlyDiscountPercent != nil {
		yearlyBps = int64(*stored.YearlyDiscountPercent) * 100
	}
	return models.TrialRules{
		TrialDays: models.TrialDaysFor(stored.TrialLength), MinimumAccountAgeDays: stored.MinimumAccountAgeDays, RequiresVerifiedEmail: stored.RequiresVerifiedEmail,
		OnePerPerson: stored.OnePerPerson, OnePerCard: stored.OnePerCard, OnePerDevice: stored.OnePerDevice,
		MaximumRiskScore: stored.MaximumRiskScore, MinimumCompletedOrders: stored.MinimumCompletedOrders,
	}, yearlyBps
}

func ReadCheckmarkPricing(ctx context.Context, source *ledgerloaders.PlatformSettingsSource, yearlyDiscountBps int64) CheckmarkPricing {
	pricing := CheckmarkPricing{Pricing: models.PricingRules{YearlyDiscountBps: yearlyDiscountBps, BundleDiscountBps: 1500, BundleMaximumBusinesses: 3}, BlackGraceDays: 14}
	raw, found := source.ReadValue(ctx, constants.CheckmarkPricingSettingKey)
	if !found {
		return pricing
	}
	var stored struct {
		BundleDiscountPercent   *int `json:"bundleDiscountPercent"`
		BundleMaximumBusinesses *int `json:"bundleMaximumBusinesses"`
		BlackGraceDays          *int `json:"blackGraceDays"`
	}
	if json.Unmarshal(raw, &stored) != nil {
		return pricing
	}
	if stored.BundleDiscountPercent != nil {
		pricing.Pricing.BundleDiscountBps = int64(*stored.BundleDiscountPercent) * 100
	}
	if stored.BundleMaximumBusinesses != nil {
		pricing.Pricing.BundleMaximumBusinesses = *stored.BundleMaximumBusinesses
	}
	if stored.BlackGraceDays != nil {
		pricing.BlackGraceDays = *stored.BlackGraceDays
	}
	return pricing
}
