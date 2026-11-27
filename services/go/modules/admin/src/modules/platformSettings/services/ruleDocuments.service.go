package services

import (
	"encoding/json"

	adminerrors "nantty/modules/admin/src/errors"
)

const (
	StaffSettingsKey        = "staff.settings"
	CheckmarkSuggestionsKey = "checkmark-suggestions"
	CreatorThresholdsKey    = "creator-thresholds"
	TrialRulesKey           = "trial-rules"
	CheckmarkPricingKey     = "checkmark-pricing"
)

type StaffSettings struct {
	RequireSecondSuperadminApproval bool `json:"requireSecondSuperadminApproval"`
}

type MoneyValue struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

type CheckmarkSuggestionRules struct {
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

type CreatorProgramThresholds struct {
	AutoApprove struct {
		MinimumAccountAgeDays            int  `json:"minimumAccountAgeDays"`
		RequiresVerifiedEmail            bool `json:"requiresVerifiedEmail"`
		MinimumRealFollowers             int  `json:"minimumRealFollowers"`
		MinimumVerifiedFollowers         int  `json:"minimumVerifiedFollowers"`
		MinimumQualifyingImpressions30d  int  `json:"minimumQualifyingImpressionsLast30Days"`
		MinimumOriginalPostsInLast60Days int  `json:"minimumOriginalPostsInLast60Days"`
		NoViolationsInDays               int  `json:"noViolationsInDays"`
		MaximumFraudScore                int  `json:"maximumFraudScore"`
		RequiresIdentityVerification     bool `json:"requiresIdentityVerification"`
	} `json:"autoApprove"`
	ManualReview struct {
		AllowsPastViolation              bool `json:"allowsPastViolation"`
		AllowsBorderlineOrAiHeavyContent bool `json:"allowsBorderlineOrAiHeavyContent"`
		MaximumRiskScore                 int  `json:"maximumRiskScore"`
	} `json:"manualReview"`
}

type TrialRules struct {
	TrialLength            string `json:"trialLength"`
	YearlyDiscountPercent  int    `json:"yearlyDiscountPercent"`
	MinimumAccountAgeDays  int    `json:"minimumAccountAgeDays"`
	RequiresVerifiedEmail  bool   `json:"requiresVerifiedEmail"`
	OnePerPerson           bool   `json:"onePerPerson"`
	OnePerCard             bool   `json:"onePerCard"`
	OnePerDevice           bool   `json:"onePerDevice"`
	MaximumRiskScore       int    `json:"maximumRiskScore"`
	MinimumCompletedOrders int    `json:"minimumCompletedOrders"`
}

type CheckmarkPricingRules struct {
	BundleDiscountPercent   int `json:"bundleDiscountPercent"`
	BundleMaximumBusinesses int `json:"bundleMaximumBusinesses"`
	BlackGraceDays          int `json:"blackGraceDays"`
	MultiBusinessRules
}

func defaultCreatorThresholds() CreatorProgramThresholds {
	thresholds := CreatorProgramThresholds{}
	thresholds.AutoApprove.MinimumAccountAgeDays, thresholds.AutoApprove.RequiresVerifiedEmail = 30, true
	thresholds.AutoApprove.MinimumRealFollowers = 10_000
	thresholds.AutoApprove.MinimumVerifiedFollowers = 500
	thresholds.AutoApprove.MinimumQualifyingImpressions30d = 100_000
	thresholds.AutoApprove.MinimumOriginalPostsInLast60Days = 10
	thresholds.AutoApprove.NoViolationsInDays, thresholds.AutoApprove.MaximumFraudScore = 90, 30
	thresholds.ManualReview.AllowsPastViolation = true
	thresholds.ManualReview.AllowsBorderlineOrAiHeavyContent, thresholds.ManualReview.MaximumRiskScore = true, 60
	return thresholds
}

func defaultCheckmarkSuggestionRules() CheckmarkSuggestionRules {
	rules := CheckmarkSuggestionRules{}
	rules.Blue.RequiresIdVerified, rules.Blue.MinimumAccountAgeDays, rules.Blue.MinimumRealFollowers, rules.Blue.NoViolationsInDays = true, 90, 1000, 90
	rules.Gold.RequiresBusinessVerification, rules.Gold.RequiresActiveStoreOrBrandPage = true, true
	rules.Gold.MinimumCompletedOrders, rules.Gold.MinimumSuccessRatePercent = 20, 90
	return rules
}

func init() {
	for key, definition := range map[string]SettingDefinition{
		StaffSettingsKey:        {Validate: validateStaffSettings, DefaultValue: StaffSettings{RequireSecondSuperadminApproval: true}},
		CheckmarkSuggestionsKey: {Validate: validateCheckmarkSuggestionRules, DefaultValue: defaultCheckmarkSuggestionRules(), WritePermission: "config:rules"},
		CreatorThresholdsKey:    {Validate: validateCreatorThresholds, DefaultValue: defaultCreatorThresholds(), WritePermission: "config:rules"},
		TrialRulesKey: {Validate: validateTrialRules, WritePermission: "config:rules", DefaultValue: TrialRules{
			TrialLength: "DAYS_7", YearlyDiscountPercent: 20, MinimumAccountAgeDays: 7, RequiresVerifiedEmail: true, OnePerPerson: true, OnePerCard: true, OnePerDevice: true, MaximumRiskScore: 50,
		}},
		CheckmarkPricingKey: {Validate: validateCheckmarkPricing, WritePermission: "config:plans", DefaultValue: CheckmarkPricingRules{
			BundleDiscountPercent: 15, BundleMaximumBusinesses: 3, BlackGraceDays: 14, MultiBusinessRules: defaultMultiBusinessRules(),
		}},
	} {
		PlatformSettingDefinitions[key] = definition
	}
}

func validateStaffSettings(raw json.RawMessage) (json.RawMessage, error) {
	var value StaffSettings
	if err := decodeStrictly(raw, &value); err != nil {
		return nil, err
	}
	return canonicalJson(value)
}

func validateCheckmarkSuggestionRules(raw json.RawMessage) (json.RawMessage, error) {
	var value CheckmarkSuggestionRules
	if err := decodeStrictly(raw, &value); err != nil {
		return nil, err
	}
	for _, check := range []error{
		requireWithin("blue.minimumAccountAgeDays", value.Blue.MinimumAccountAgeDays, 0, 3650),
		requireWithin("blue.minimumRealFollowers", value.Blue.MinimumRealFollowers, 0, 100_000_000),
		requireWithin("blue.noViolationsInDays", value.Blue.NoViolationsInDays, 0, 3650),
		requireWithin("gold.minimumCompletedOrders", value.Gold.MinimumCompletedOrders, 0, 1_000_000),
		requireWithin("gold.minimumSuccessRatePercent", value.Gold.MinimumSuccessRatePercent, 0, 100),
	} {
		if check != nil {
			return nil, check
		}
	}
	return canonicalJson(value)
}

func validateCreatorThresholds(raw json.RawMessage) (json.RawMessage, error) {
	var value CreatorProgramThresholds
	if err := decodeStrictly(raw, &value); err != nil {
		return nil, err
	}
	auto, review := value.AutoApprove, value.ManualReview
	if !auto.RequiresVerifiedEmail {
		return nil, adminerrors.Unprocessable("Creator applications always require verified email.")
	}
	for _, check := range []error{
		requireWithin("autoApprove.minimumAccountAgeDays", auto.MinimumAccountAgeDays, 30, 3650),
		requireWithin("autoApprove.minimumRealFollowers", auto.MinimumRealFollowers, 10_000, 100_000_000),
		requireWithin("autoApprove.minimumVerifiedFollowers", auto.MinimumVerifiedFollowers, 500, 100_000_000),
		requireWithin("autoApprove.minimumQualifyingImpressionsLast30Days", auto.MinimumQualifyingImpressions30d, 100_000, 1_000_000_000),
		requireWithin("autoApprove.minimumOriginalPostsInLast60Days", auto.MinimumOriginalPostsInLast60Days, 10, 100_000),
		requireWithin("autoApprove.noViolationsInDays", auto.NoViolationsInDays, 90, 3650),
		requireWithin("autoApprove.maximumFraudScore", auto.MaximumFraudScore, 0, 100),
		requireWithin("manualReview.maximumRiskScore", review.MaximumRiskScore, 0, 100),
	} {
		if check != nil {
			return nil, check
		}
	}
	return canonicalJson(value)
}

func validateTrialRules(raw json.RawMessage) (json.RawMessage, error) {
	var value TrialRules
	if err := decodeStrictly(raw, &value); err != nil {
		return nil, err
	}
	if value.TrialLength != "DAYS_7" && value.TrialLength != "MONTH_1" {
		return nil, adminerrors.Unprocessable("trialLength must be DAYS_7 or MONTH_1.")
	}
	for _, check := range []error{
		requireWithin("yearlyDiscountPercent", value.YearlyDiscountPercent, 0, 90),
		requireWithin("minimumAccountAgeDays", value.MinimumAccountAgeDays, 0, 3650),
		requireWithin("maximumRiskScore", value.MaximumRiskScore, 0, 100),
		requireWithin("minimumCompletedOrders", value.MinimumCompletedOrders, 0, 1_000_000),
	} {
		if check != nil {
			return nil, check
		}
	}
	return canonicalJson(value)
}

func validateCheckmarkPricing(raw json.RawMessage) (json.RawMessage, error) {
	var value CheckmarkPricingRules
	if err := decodeStrictly(raw, &value); err != nil {
		return nil, err
	}
	for _, check := range []error{
		requireWithin("bundleDiscountPercent", value.BundleDiscountPercent, 0, 90),
		requireWithin("bundleMaximumBusinesses", value.BundleMaximumBusinesses, 1, 100),
		requireWithin("blackGraceDays", value.BlackGraceDays, 0, 90),
		validateMultiBusinessRules(value.MultiBusinessRules),
	} {
		if check != nil {
			return nil, check
		}
	}
	return canonicalJson(value)
}
