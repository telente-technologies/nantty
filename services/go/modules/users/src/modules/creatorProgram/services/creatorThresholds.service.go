package services

import (
	"context"
	"encoding/json"

	"nantty/platform/identityports"
)

type AutoApproveRules struct {
	MinimumAccountAgeDays            int  `json:"minimumAccountAgeDays"`
	RequiresVerifiedEmail            bool `json:"requiresVerifiedEmail"`
	MinimumRealFollowers             int  `json:"minimumRealFollowers"`
	MinimumVerifiedFollowers         int  `json:"minimumVerifiedFollowers"`
	MinimumQualifyingImpressions30d  int  `json:"minimumQualifyingImpressionsLast30Days"`
	MinimumOriginalPostsInLast60Days int  `json:"minimumOriginalPostsInLast60Days"`
	NoViolationsInDays               int  `json:"noViolationsInDays"`
	MaximumFraudScore                int  `json:"maximumFraudScore"`
	RequiresIdentityVerification     bool `json:"requiresIdentityVerification"`
}

type ManualReviewRules struct {
	AllowsPastViolation              bool `json:"allowsPastViolation"`
	AllowsBorderlineOrAiHeavyContent bool `json:"allowsBorderlineOrAiHeavyContent"`
	MaximumRiskScore                 int  `json:"maximumRiskScore"`
}

type CreatorThresholds struct {
	AutoApprove  AutoApproveRules  `json:"autoApprove"`
	ManualReview ManualReviewRules `json:"manualReview"`
}

func DefaultCreatorThresholds() CreatorThresholds {
	thresholds := CreatorThresholds{}
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

func LoadCreatorThresholds(ctx context.Context) CreatorThresholds {
	thresholds := DefaultCreatorThresholds()
	settings, err := identityports.Default.PlatformSettings()
	if err != nil {
		return thresholds
	}
	raw, _, err := settings.ReadSettingValue(ctx, "creator-thresholds")
	if err != nil {
		return thresholds
	}
	return DecodeCreatorThresholds(raw)
}

func DecodeCreatorThresholds(raw []byte) CreatorThresholds {
	thresholds := DefaultCreatorThresholds()
	if json.Unmarshal(raw, &thresholds) != nil {
		return DefaultCreatorThresholds()
	}
	thresholds.AutoApprove.MinimumRealFollowers = max(thresholds.AutoApprove.MinimumRealFollowers, 10_000)
	thresholds.AutoApprove.MinimumVerifiedFollowers = max(thresholds.AutoApprove.MinimumVerifiedFollowers, 500)
	thresholds.AutoApprove.MinimumQualifyingImpressions30d = max(thresholds.AutoApprove.MinimumQualifyingImpressions30d, 100_000)
	thresholds.AutoApprove.MinimumOriginalPostsInLast60Days = max(thresholds.AutoApprove.MinimumOriginalPostsInLast60Days, 10)
	thresholds.AutoApprove.MinimumAccountAgeDays = max(thresholds.AutoApprove.MinimumAccountAgeDays, 30)
	thresholds.AutoApprove.NoViolationsInDays = max(thresholds.AutoApprove.NoViolationsInDays, 90)
	thresholds.AutoApprove.RequiresVerifiedEmail = true
	return thresholds
}
