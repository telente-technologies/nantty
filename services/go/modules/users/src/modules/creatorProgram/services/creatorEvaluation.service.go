package services

import (
	"context"
	"fmt"
	"time"

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
	DecisionUnavailable  = "unavailable"
)

type Requirement struct {
	Key           string `json:"key"`
	Label         string `json:"label"`
	CurrentValue  int    `json:"currentValue"`
	RequiredValue int    `json:"requiredValue"`
	Remaining     int    `json:"remaining"`
	Met           bool   `json:"met"`
	Available     bool   `json:"available"`
	Source        string `json:"source"`
	DataAsOf      string `json:"dataAsOf,omitempty"`
}

type Eligibility struct {
	Eligible          bool          `json:"eligible"`
	Decision          string        `json:"decision"`
	DecisionNote      string        `json:"decisionNote"`
	Requirements      []Requirement `json:"requirements"`
	MetricsAvailable  bool          `json:"metricsAvailable"`
	StandingAvailable bool          `json:"standingAvailable"`
	MetricsSource     string        `json:"metricsSource,omitempty"`
	MetricsAsOf       string        `json:"metricsAsOf,omitempty"`
}

var decisionNotes = map[string]string{
	DecisionAutoApprove:  "You meet every requirement. Your application will be approved automatically.",
	DecisionManualReview: "You meet the requirements. A member of our team will review your application within 2 working days.",
	DecisionNotEligible:  "Keep going. This list updates automatically as you grow.",
	DecisionUnavailable:  "Eligibility cannot be evaluated until trusted analytics and moderation data are available.",
}

func LoadProfileSignals(ctx context.Context, application *container.Container, profileId uuid.UUID) (*ent.ProfileSignal, error) {
	signals, err := application.Client.ProfileSignal.Query().Where(profilesignal.ProfileID(profileId)).Only(ctx)
	if ent.IsNotFound(err) {
		return &ent.ProfileSignal{ProfileID: profileId}, nil
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
	metricsAsOf := ""
	metricsAvailable := signals.CreatorMetricsSnapshotID != nil && signals.CreatorMetricsAsOf != nil && signals.CreatorMetricsSource == "analytics_creator_eligibility_v1"
	if metricsAvailable {
		metricsAsOf = signals.CreatorMetricsAsOf.UTC().Format(time.RFC3339)
		metricsAvailable = !signals.CreatorMetricsAsOf.Before(application.Now().Add(-24*time.Hour)) && !signals.CreatorMetricsAsOf.After(application.Now().Add(5*time.Minute))
	}
	standingAsOf := ""
	standingAvailable := signals.CreatorStandingAvailable && signals.CreatorStandingAsOf != nil && signals.CreatorStandingSource == "moderation_creator_standing_v1" && signals.CreatorStandingSnapshotID != nil
	standingDays := 0
	if standingAvailable {
		standingAsOf = signals.CreatorStandingAsOf.UTC().Format(time.RFC3339)
		standingDays = signals.CreatorDaysSinceLastViolation
		standingAvailable = !signals.CreatorStandingAsOf.Before(application.Now().Add(-24*time.Hour)) && !signals.CreatorStandingAsOf.After(application.Now().Add(5*time.Minute))
		if !standingAvailable {
			standingDays = 0
		}
	}
	flag := func(condition bool) int {
		if condition {
			return 1
		}
		return 0
	}
	metricsData := []struct {
		key, label        string
		current, required int
		source, asOf      string
	}{
		{"qualifying_impressions_30d", "Qualifying impressions from verified users in the last 30 days", signals.QualifyingImpressionsLast30Days, auto.MinimumQualifyingImpressions30d, signals.CreatorMetricsSource, metricsAsOf},
		{"real_followers", "Real followers", signals.CreatorRealFollowers, auto.MinimumRealFollowers, signals.CreatorMetricsSource, metricsAsOf},
		{"verified_followers", "Verified followers", signals.VerifiedFollowers, auto.MinimumVerifiedFollowers, signals.CreatorMetricsSource, metricsAsOf},
		{"account_age", fmt.Sprintf("Account at least %d days old", auto.MinimumAccountAgeDays), ageDays, auto.MinimumAccountAgeDays, "identity", application.Now().UTC().Format(time.RFC3339)},
		{"verified_email", "Verified email", flag(account.EmailVerified), 1, "identity", application.Now().UTC().Format(time.RFC3339)},
		{"original_posts", fmt.Sprintf("Original posts in the last 60 days (minimum %d)", auto.MinimumOriginalPostsInLast60Days), signals.CreatorOriginalPostsLast60Days, auto.MinimumOriginalPostsInLast60Days, signals.CreatorMetricsSource, metricsAsOf},
		{"policy_standing", fmt.Sprintf("Days since last policy violation (target %d)", auto.NoViolationsInDays), standingDays, auto.NoViolationsInDays, signals.CreatorStandingSource, standingAsOf},
	}
	requirements := make([]Requirement, 0, len(metricsData))
	for _, metric := range metricsData {
		current := metric.current
		available := true
		if metric.key == "real_followers" || metric.key == "verified_followers" || metric.key == "qualifying_impressions_30d" || metric.key == "original_posts" {
			available = metricsAvailable
		}
		if metric.key == "policy_standing" {
			available = standingAvailable
		}
		requirements = append(requirements, Requirement{Key: metric.key, Label: metric.label, CurrentValue: current, RequiredValue: metric.required, Remaining: max(metric.required-current, 0), Met: available && current >= metric.required, Available: available, Source: metric.source, DataAsOf: metric.asOf})
	}
	for index := range requirements {
		requirements[index].Met = requirements[index].Available && requirements[index].CurrentValue >= requirements[index].RequiredValue
	}
	allMet := true
	for _, requirement := range requirements {
		allMet = allMet && requirement.Met
	}
	emailOk := account.EmailVerified || !auto.RequiresVerifiedEmail
	mandatory := metricsAvailable
	for _, requirement := range requirements {
		if requirement.Key != "policy_standing" && !requirement.Met {
			mandatory = false
		}
	}
	decision := DecisionNotEligible
	reviewSignals := *signals
	if standingAvailable {
		reviewSignals.DaysSinceLastViolation = standingDays
	} else {
		reviewSignals.DaysSinceLastViolation = 0
	}
	switch {
	case mandatory && emailOk && allMet && signals.FraudScore <= auto.MaximumFraudScore && signals.RiskScore <= review.MaximumRiskScore && MeetsAdditionalAutoApproveRules(signals, auto):
		decision = DecisionAutoApprove
	case mandatory && emailOk && QualifiesForManualReview(&reviewSignals, review, ageDays, auto.MinimumAccountAgeDays):
		decision = DecisionManualReview
	}
	if !metricsAvailable || !standingAvailable {
		decision = DecisionUnavailable
	}
	return Eligibility{Eligible: decision == DecisionAutoApprove || decision == DecisionManualReview, Decision: decision, DecisionNote: decisionNotes[decision], Requirements: requirements, MetricsAvailable: metricsAvailable, StandingAvailable: standingAvailable, MetricsSource: signals.CreatorMetricsSource, MetricsAsOf: metricsAsOf}, nil
}

// These rules are nested under autoApprove in the staff policy, so failing
// them routes an otherwise review-qualified applicant to manual review rather
// than turning the rules into new hard rejection criteria.
func MeetsAdditionalAutoApproveRules(signals *ent.ProfileSignal, rules AutoApproveRules) bool {
	return !rules.RequiresIdentityVerification || signals.IDVerified
}

func QualifiesForManualReview(signals *ent.ProfileSignal, review ManualReviewRules, ageDays, minimumAgeDays int) bool {
	if signals.RiskScore > review.MaximumRiskScore || ageDays < minimumAgeDays {
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
