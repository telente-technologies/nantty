package services

import (
	"encoding/json"

	adminerrors "nantty/modules/admin/src/errors"
)

type CreatorEligibilityRules struct {
	MinimumFollowers                       int  `json:"minimumFollowers"`
	MinimumVerifiedFollowers               int  `json:"minimumVerifiedFollowers"`
	MinimumQualifyingImpressionsLast30Days int  `json:"minimumQualifyingImpressionsLast30Days"`
	MinimumOriginalPosts                   int  `json:"minimumOriginalPosts"`
	MinimumOriginalPostsInLast60Days       int  `json:"minimumOriginalPostsInLast60Days"`
	MinimumAccountAgeDays                  int  `json:"minimumAccountAgeDays"`
	NoViolationsInDays                     int  `json:"noViolationsInDays"`
	RequiresVerifiedEmail                  bool `json:"requiresVerifiedEmail"`
	RequiresIdentityVerification           bool `json:"requiresIdentityVerification"`
}

func defaultCreatorEligibility() CreatorEligibilityRules {
	return creatorEligibilityFromThresholds(defaultCreatorThresholds())
}

func defaultCreatorRequirements() CreatorRequirements {
	return creatorRequirementsFromThresholds(defaultCreatorThresholds())
}

func creatorRequirementsFromThresholds(thresholds CreatorProgramThresholds) CreatorRequirements {
	auto := thresholds.AutoApprove
	return CreatorRequirements{
		MinimumFollowers: auto.MinimumRealFollowers, MinimumVerifiedFollowers: auto.MinimumVerifiedFollowers,
		MinimumQualifyingImpressionsLast30Days: auto.MinimumQualifyingImpressions30d,
		MinimumAccountAgeDays:                  auto.MinimumAccountAgeDays, MinimumOriginalPosts: auto.MinimumOriginalPostsInLast60Days,
		MinimumOriginalPostsInLast60Days: auto.MinimumOriginalPostsInLast60Days, MaximumRecentStrikes: 0,
		StrikeLookbackDays: auto.NoViolationsInDays, RequireVerifiedEmail: auto.RequiresVerifiedEmail,
		RequiresIdentityVerification: auto.RequiresIdentityVerification,
	}
}

func creatorEligibilityFromThresholds(thresholds CreatorProgramThresholds) CreatorEligibilityRules {
	auto := thresholds.AutoApprove
	return CreatorEligibilityRules{
		MinimumFollowers: auto.MinimumRealFollowers, MinimumVerifiedFollowers: auto.MinimumVerifiedFollowers,
		MinimumQualifyingImpressionsLast30Days: auto.MinimumQualifyingImpressions30d,
		MinimumOriginalPosts:                   auto.MinimumOriginalPostsInLast60Days, MinimumOriginalPostsInLast60Days: auto.MinimumOriginalPostsInLast60Days,
		MinimumAccountAgeDays: auto.MinimumAccountAgeDays, NoViolationsInDays: auto.NoViolationsInDays,
		RequiresVerifiedEmail: auto.RequiresVerifiedEmail, RequiresIdentityVerification: auto.RequiresIdentityVerification,
	}
}

func projectCreatorRequirements(source json.RawMessage) (json.RawMessage, error) {
	thresholds := defaultCreatorThresholds()
	if err := json.Unmarshal(source, &thresholds); err != nil {
		return nil, err
	}
	return json.Marshal(creatorRequirementsFromThresholds(thresholds))
}

func mergeCreatorRequirements(source, value json.RawMessage) (json.RawMessage, error) {
	thresholds := defaultCreatorThresholds()
	if err := json.Unmarshal(source, &thresholds); err != nil {
		return nil, err
	}
	var requirements CreatorRequirements
	if err := json.Unmarshal(value, &requirements); err != nil {
		return nil, err
	}
	if requirements.MinimumOriginalPostsInLast60Days == 0 {
		requirements.MinimumOriginalPostsInLast60Days = requirements.MinimumOriginalPosts
	}
	if requirements.MinimumOriginalPosts == 0 {
		requirements.MinimumOriginalPosts = requirements.MinimumOriginalPostsInLast60Days
	}
	auto := &thresholds.AutoApprove
	auto.MinimumRealFollowers = requirements.MinimumFollowers
	auto.MinimumVerifiedFollowers = requirements.MinimumVerifiedFollowers
	auto.MinimumQualifyingImpressions30d = requirements.MinimumQualifyingImpressionsLast30Days
	auto.MinimumAccountAgeDays = requirements.MinimumAccountAgeDays
	posts := requirements.MinimumOriginalPostsInLast60Days
	if posts == 0 {
		posts = requirements.MinimumOriginalPosts
	}
	auto.MinimumOriginalPostsInLast60Days = posts
	auto.NoViolationsInDays = requirements.StrikeLookbackDays
	auto.RequiresVerifiedEmail = requirements.RequireVerifiedEmail
	auto.RequiresIdentityVerification = requirements.RequiresIdentityVerification
	return json.Marshal(thresholds)
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
	auto.MinimumRealFollowers, auto.MinimumVerifiedFollowers = eligibility.MinimumFollowers, eligibility.MinimumVerifiedFollowers
	auto.MinimumQualifyingImpressions30d = eligibility.MinimumQualifyingImpressionsLast30Days
	auto.MinimumOriginalPostsInLast60Days = eligibility.MinimumOriginalPostsInLast60Days
	auto.MinimumAccountAgeDays, auto.RequiresIdentityVerification = eligibility.MinimumAccountAgeDays, eligibility.RequiresIdentityVerification
	auto.NoViolationsInDays, auto.RequiresVerifiedEmail = eligibility.NoViolationsInDays, eligibility.RequiresVerifiedEmail
	return json.Marshal(thresholds)
}

func validateCreatorEligibility(raw json.RawMessage) (json.RawMessage, error) {
	var value CreatorEligibilityRules
	if err := decodeStrictly(raw, &value); err != nil {
		return nil, err
	}
	if err := firstFailure(
		requireWithin("minimumFollowers", value.MinimumFollowers, 10_000, 100_000_000),
		requireWithin("minimumVerifiedFollowers", value.MinimumVerifiedFollowers, 500, 100_000_000),
		requireWithin("minimumQualifyingImpressionsLast30Days", value.MinimumQualifyingImpressionsLast30Days, 100_000, 1_000_000_000),
		requireWithin("minimumOriginalPosts", value.MinimumOriginalPosts, 10, 100_000),
		requireWithin("minimumOriginalPostsInLast60Days", value.MinimumOriginalPostsInLast60Days, 10, 100_000),
		requireWithin("minimumAccountAgeDays", value.MinimumAccountAgeDays, 30, 3650),
		requireWithin("noViolationsInDays", value.NoViolationsInDays, 90, 3650),
	); err != nil {
		return nil, err
	}
	if value.MinimumOriginalPosts != value.MinimumOriginalPostsInLast60Days {
		return nil, adminerrors.Unprocessable("minimumOriginalPosts and minimumOriginalPostsInLast60Days must match.")
	}
	if !value.RequiresVerifiedEmail {
		return nil, adminerrors.Unprocessable("Creator eligibility requires verified email.")
	}
	return canonicalJson(value)
}

func validateProjectedCreatorRequirements(raw json.RawMessage) (json.RawMessage, error) {
	var value CreatorRequirements
	if err := decodeStrictly(raw, &value); err != nil {
		return nil, err
	}
	if value.MinimumOriginalPostsInLast60Days == 0 {
		value.MinimumOriginalPostsInLast60Days = value.MinimumOriginalPosts
	}
	if value.MinimumOriginalPosts == 0 {
		value.MinimumOriginalPosts = value.MinimumOriginalPostsInLast60Days
	}
	for _, check := range []error{
		requireWithin("minimumFollowers", value.MinimumFollowers, 10_000, 100_000_000),
		requireWithin("minimumVerifiedFollowers", value.MinimumVerifiedFollowers, 500, 100_000_000),
		requireWithin("minimumQualifyingImpressionsLast30Days", value.MinimumQualifyingImpressionsLast30Days, 100_000, 1_000_000_000),
		requireWithin("minimumAccountAgeDays", value.MinimumAccountAgeDays, 30, 3650),
		requireWithin("minimumOriginalPosts", value.MinimumOriginalPosts, 10, 100_000),
		requireWithin("minimumOriginalPostsInLast60Days", value.MinimumOriginalPostsInLast60Days, 10, 100_000),
		requireWithin("strikeLookbackDays", value.StrikeLookbackDays, 90, 3650),
	} {
		if check != nil {
			return nil, check
		}
	}
	if value.MinimumOriginalPosts != value.MinimumOriginalPostsInLast60Days {
		return nil, adminerrors.Unprocessable("Original-post minimums must match.")
	}
	if value.MinimumOriginalPosts != value.MinimumOriginalPostsInLast60Days || value.MaximumRecentStrikes != 0 || !value.RequireVerifiedEmail {
		return nil, adminerrors.Unprocessable("Creator eligibility requires matching original-post minimums, no recent strikes, and verified email.")
	}
	return canonicalJson(value)
}
