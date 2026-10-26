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
	MinimumOriginalPostsInLast60Days int  `json:"minimumOriginalPostsInLast60Days"`
	NoViolationsInDays               int  `json:"noViolationsInDays"`
	MaximumFraudScore                int  `json:"maximumFraudScore"`
}

type ManualReviewRules struct {
	MinimumRealFollowers             int  `json:"minimumRealFollowers"`
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
	thresholds.AutoApprove.MinimumRealFollowers, thresholds.AutoApprove.MinimumOriginalPostsInLast60Days = 1000, 10
	thresholds.AutoApprove.NoViolationsInDays, thresholds.AutoApprove.MaximumFraudScore = 90, 30
	thresholds.ManualReview.MinimumRealFollowers, thresholds.ManualReview.AllowsPastViolation = 500, true
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
	var configured CreatorThresholds
	if json.Unmarshal(raw, &configured) != nil {
		return thresholds
	}
	return configured
}
