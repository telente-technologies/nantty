package services_test

import (
	"testing"

	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/modules/creatorProgram/services"
)

func TestQualifiesForManualReviewFollowsTheAdminConfiguredRules(t *testing.T) {
	rules := services.DefaultCreatorThresholds().ManualReview
	cases := []struct {
		name    string
		signals ent.ProfileSignal
		age     int
		want    bool
	}{
		{"low risk is reviewable", ent.ProfileSignal{RiskScore: 10, DaysSinceLastViolation: 400}, 60, true},
		{"risk above the limit", ent.ProfileSignal{RiskScore: 61, DaysSinceLastViolation: 400}, 60, false},
		{"account younger than the minimum age", ent.ProfileSignal{DaysSinceLastViolation: 400}, 5, false},
		{"a past violation is allowed by default", ent.ProfileSignal{DaysSinceLastViolation: 10}, 60, true},
		{"borderline content is allowed by default", ent.ProfileSignal{BorderlineContent: true, DaysSinceLastViolation: 400}, 60, true},
	}
	for _, testCase := range cases {
		signals := testCase.signals
		if got := services.QualifiesForManualReview(&signals, rules, testCase.age, 30); got != testCase.want {
			t.Errorf("%s: got %v want %v", testCase.name, got, testCase.want)
		}
	}
	strict := rules
	strict.AllowsPastViolation, strict.AllowsBorderlineOrAiHeavyContent = false, false
	if services.QualifiesForManualReview(&ent.ProfileSignal{DaysSinceLastViolation: 10}, strict, 60, 30) {
		t.Error("a recent violation must block review when the admin disallows it")
	}
	if services.QualifiesForManualReview(&ent.ProfileSignal{BorderlineContent: true, DaysSinceLastViolation: 400}, strict, 60, 30) {
		t.Error("borderline content must block review when the admin disallows it")
	}
}

func TestAdditionalAutoApproveRules(t *testing.T) {
	verified := ent.ProfileSignal{IDVerified: true}
	unverified := ent.ProfileSignal{}
	cases := []struct {
		name   string
		signal *ent.ProfileSignal
		rules  services.AutoApproveRules
		want   bool
	}{
		{"identity verification is not required by default", &unverified, services.AutoApproveRules{}, true},
		{"identity verification is required when configured", &unverified, services.AutoApproveRules{RequiresIdentityVerification: true}, false},
		{"verified identity satisfies configured requirement", &verified, services.AutoApproveRules{RequiresIdentityVerification: true}, true},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := services.MeetsAdditionalAutoApproveRules(testCase.signal, testCase.rules); got != testCase.want {
				t.Fatalf("got %v want %v", got, testCase.want)
			}
		})
	}
}

func TestCreatorThresholdsEnforceOwnerMinimums(t *testing.T) {
	thresholds := services.DecodeCreatorThresholds([]byte(`{"autoApprove":{"minimumAccountAgeDays":45},"manualReview":{}}`))
	if thresholds.AutoApprove.MinimumAccountAgeDays != 45 {
		t.Fatalf("configured field not applied: got %d", thresholds.AutoApprove.MinimumAccountAgeDays)
	}
	if !thresholds.AutoApprove.RequiresVerifiedEmail || thresholds.AutoApprove.MinimumRealFollowers != 10_000 || thresholds.AutoApprove.MinimumVerifiedFollowers != 500 || thresholds.AutoApprove.MinimumQualifyingImpressions30d != 100_000 || thresholds.AutoApprove.MinimumOriginalPostsInLast60Days != 10 || thresholds.AutoApprove.MaximumFraudScore != 30 {
		t.Fatalf("owner minimums were not enforced: %+v", thresholds.AutoApprove)
	}
	if thresholds.AutoApprove.RequiresIdentityVerification {
		t.Fatalf("omitted new rules should remain disabled: %+v", thresholds.AutoApprove)
	}
}
