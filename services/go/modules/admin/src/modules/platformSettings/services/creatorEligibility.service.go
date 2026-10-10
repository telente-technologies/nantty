package services

import (
	"encoding/json"
)

type CreatorEligibilityRules struct {
	MinimumFollowers             int      `json:"minimumFollowers"`
	MinimumPostsInLast30Days     int      `json:"minimumPostsInLast30Days"`
	MaximumActiveStrikes         int      `json:"maximumActiveStrikes"`
	MinimumAccountAgeDays        int      `json:"minimumAccountAgeDays"`
	RequiresIdentityVerification bool     `json:"requiresIdentityVerification"`
	AllowedCountries             []string `json:"allowedCountries"`
}

func defaultCreatorEligibility() CreatorEligibilityRules {
	return creatorEligibilityFromThresholds(defaultCreatorThresholds())
}

func creatorEligibilityFromThresholds(thresholds CreatorProgramThresholds) CreatorEligibilityRules {
	auto := thresholds.AutoApprove
	countries := auto.AllowedCountries
	if countries == nil {
		countries = []string{}
	}
	return CreatorEligibilityRules{
		MinimumFollowers: auto.MinimumRealFollowers, MinimumPostsInLast30Days: auto.MinimumOriginalPostsInLast60Days, MaximumActiveStrikes: auto.MaximumActiveStrikes,
		MinimumAccountAgeDays: auto.MinimumAccountAgeDays, RequiresIdentityVerification: auto.RequiresIdentityVerification, AllowedCountries: countries,
	}
}

func projectCreatorEligibility(source json.RawMessage) (json.RawMessage, error) {
	thresholds := defaultCreatorThresholds()
	if err := json.Unmarshal(source, &thresholds); err != nil {
		return nil, err
	}
	return json.Marshal(creatorEligibilityFromThresholds(thresholds))
}

func mergeCreatorEligibility(source, value json.RawMessage) (json.RawMessage, error) {
	thresholds := defaultCreatorThresholds()
	if err := json.Unmarshal(source, &thresholds); err != nil {
		return nil, err
	}
	var eligibility CreatorEligibilityRules
	if err := json.Unmarshal(value, &eligibility); err != nil {
		return nil, err
	}
	auto := &thresholds.AutoApprove
	auto.MinimumRealFollowers, auto.MinimumOriginalPostsInLast60Days, auto.MaximumActiveStrikes = eligibility.MinimumFollowers, eligibility.MinimumPostsInLast30Days, eligibility.MaximumActiveStrikes
	auto.MinimumAccountAgeDays, auto.RequiresIdentityVerification, auto.AllowedCountries = eligibility.MinimumAccountAgeDays, eligibility.RequiresIdentityVerification, eligibility.AllowedCountries
	return json.Marshal(thresholds)
}

func validateCreatorEligibility(raw json.RawMessage) (json.RawMessage, error) {
	var value CreatorEligibilityRules
	if err := decodeStrictly(raw, &value); err != nil {
		return nil, err
	}
	if value.AllowedCountries == nil {
		value.AllowedCountries = []string{}
	}
	if err := firstFailure(
		requireWithin("minimumFollowers", value.MinimumFollowers, 0, 10_000_000),
		requireWithin("minimumPostsInLast30Days", value.MinimumPostsInLast30Days, 0, 10_000),
		requireWithin("maximumActiveStrikes", value.MaximumActiveStrikes, 0, 100),
		requireWithin("minimumAccountAgeDays", value.MinimumAccountAgeDays, 0, 3650),
		requireCodes("allowedCountries", value.AllowedCountries, isoCountryPattern, 0),
	); err != nil {
		return nil, err
	}
	return canonicalJson(value)
}
