package services

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/profilesignal"
	"nantty/platform/identityports"
)

const (
	DecisionAutoApprove  = "auto_approve"
	DecisionManualReview = "manual_review"
	DecisionNotEligible  = "not_eligible"
)

type Requirement struct {
	Key           string `json:"key"`
	Label         string `json:"label"`
	CurrentValue  int    `json:"currentValue"`
	RequiredValue int    `json:"requiredValue"`
	Met           bool   `json:"met"`
}

type Eligibility struct {
	Eligible     bool          `json:"eligible"`
	Decision     string        `json:"decision"`
	DecisionNote string        `json:"decisionNote"`
	Requirements []Requirement `json:"requirements"`
}

var decisionNotes = map[string]string{
	DecisionAutoApprove:  "You meet every requirement. Your application will be approved automatically.",
	DecisionManualReview: "You meet the requirements. A member of our team will review your application within 2 working days.",
	DecisionNotEligible:  "Keep going. This list updates automatically as you grow.",
}

func LoadProfileSignals(ctx context.Context, application *container.Container, profileId uuid.UUID) (*ent.ProfileSignal, error) {
	signals, err := application.Client.ProfileSignal.Query().Where(profilesignal.ProfileID(profileId)).Only(ctx)
	if ent.IsNotFound(err) {
		return &ent.ProfileSignal{ProfileID: profileId, DaysSinceLastViolation: 100000}, nil
	}
	return signals, err
}

func EvaluateCreatorEligibility(ctx context.Context, application *container.Container, profile *ent.Profile, account identityports.AccountSummary) (Eligibility, error) {
	signals, err := LoadProfileSignals(ctx, application, profile.ID)
	if err != nil {
		return Eligibility{}, err
	}
	thresholds := LoadCreatorThresholds(ctx)
	auto, review := thresholds.AutoApprove, thresholds.ManualReview
	ageDays := int(application.Now().Sub(account.CreatedAt).Hours() / 24)
	flag := func(condition bool) int {
		if condition {
			return 1
		}
		return 0
	}
	requirements := []Requirement{
		{Key: "followers", Label: fmt.Sprintf("At least %s real followers", formatThousands(auto.MinimumRealFollowers)), CurrentValue: signals.RealFollowers, RequiredValue: auto.MinimumRealFollowers},
		{Key: "account_age", Label: fmt.Sprintf("Account at least %d days old", auto.MinimumAccountAgeDays), CurrentValue: ageDays, RequiredValue: auto.MinimumAccountAgeDays},
		{Key: "original_posts", Label: fmt.Sprintf("%d original posts in the last 60 days", auto.MinimumOriginalPostsInLast60Days), CurrentValue: signals.OriginalPostsLast60Days, RequiredValue: auto.MinimumOriginalPostsInLast60Days},
		{Key: "no_violations", Label: fmt.Sprintf("No violations in the last %d days", auto.NoViolationsInDays), CurrentValue: flag(signals.DaysSinceLastViolation >= auto.NoViolationsInDays), RequiredValue: 1},
	}
	for index := range requirements {
		requirements[index].Met = requirements[index].CurrentValue >= requirements[index].RequiredValue
	}
	allMet := true
	for _, requirement := range requirements {
		allMet = allMet && requirement.Met
	}
	emailOk := account.EmailVerified || !auto.RequiresVerifiedEmail
	decision := DecisionNotEligible
	switch {
	case allMet && emailOk && signals.FraudScore <= auto.MaximumFraudScore && MeetsAdditionalAutoApproveRules(signals, auto):
		decision = DecisionAutoApprove
	case emailOk && QualifiesForManualReview(signals, review, ageDays, auto.MinimumAccountAgeDays):
		decision = DecisionManualReview
	}
	return Eligibility{Eligible: decision != DecisionNotEligible, Decision: decision, DecisionNote: decisionNotes[decision], Requirements: requirements}, nil
}

// These rules are nested under autoApprove in the staff policy, so failing
// them routes an otherwise review-qualified applicant to manual review rather
// than turning the rules into new hard rejection criteria.
func MeetsAdditionalAutoApproveRules(signals *ent.ProfileSignal, rules AutoApproveRules) bool {
	return !rules.RequiresIdentityVerification || signals.IDVerified
}

func QualifiesForManualReview(signals *ent.ProfileSignal, review ManualReviewRules, ageDays, minimumAgeDays int) bool {
	if signals.RealFollowers < review.MinimumRealFollowers || signals.RiskScore > review.MaximumRiskScore || ageDays < minimumAgeDays {
		return false
	}
	if signals.DaysSinceLastViolation < 90 && !review.AllowsPastViolation {
		return false
	}
	return !signals.BorderlineContent || review.AllowsBorderlineOrAiHeavyContent
}

func formatThousands(value int) string {
	if value >= 1000 && value%1000 == 0 {
		return fmt.Sprintf("%d,000", value/1000)
	}
	return fmt.Sprintf("%d", value)
}
