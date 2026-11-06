package services

import (
	"encoding/json"
	"testing"

	"nantty/modules/users/src/generated/ent"
)

func TestQualifiesForManualReviewFollowsTheAdminConfiguredRules(t *testing.T) {
	rules := DefaultCreatorThresholds().ManualReview
	cases := []struct {
		name    string
		signals ent.ProfileSignal
		age     int
		want    bool
	}{
		{"500 followers and low risk", ent.ProfileSignal{RealFollowers: 500, RiskScore: 10, DaysSinceLastViolation: 400}, 60, true},
		{"499 followers is below the review floor", ent.ProfileSignal{RealFollowers: 499, DaysSinceLastViolation: 400}, 60, false},
		{"risk above the limit", ent.ProfileSignal{RealFollowers: 900, RiskScore: 61, DaysSinceLastViolation: 400}, 60, false},
		{"account younger than the minimum age", ent.ProfileSignal{RealFollowers: 900, DaysSinceLastViolation: 400}, 5, false},
		{"a past violation is allowed by default", ent.ProfileSignal{RealFollowers: 900, DaysSinceLastViolation: 10}, 60, true},
		{"borderline content is allowed by default", ent.ProfileSignal{RealFollowers: 900, BorderlineContent: true, DaysSinceLastViolation: 400}, 60, true},
	}
	for _, testCase := range cases {
		signals := testCase.signals
		if got := qualifiesForManualReview(&signals, rules, testCase.age, 30); got != testCase.want {
			t.Errorf("%s: got %v want %v", testCase.name, got, testCase.want)
		}
	}
	strict := rules
	strict.AllowsPastViolation, strict.AllowsBorderlineOrAiHeavyContent = false, false
	if qualifiesForManualReview(&ent.ProfileSignal{RealFollowers: 900, DaysSinceLastViolation: 10}, strict, 60, 30) {
		t.Error("a recent violation must block review when the admin disallows it")
	}
	if qualifiesForManualReview(&ent.ProfileSignal{RealFollowers: 900, BorderlineContent: true, DaysSinceLastViolation: 400}, strict, 60, 30) {
		t.Error("borderline content must block review when the admin disallows it")
	}
}

func TestAdditionalAutoApproveRules(t *testing.T) {
	verified := ent.ProfileSignal{IDVerified: true}
	unverified := ent.ProfileSignal{}
	cases := []struct {
		name   string
		signal *ent.ProfileSignal
		rules  AutoApproveRules
		want   bool
	}{
		{"identity verification is not required by default", &unverified, AutoApproveRules{}, true},
		{"identity verification is required when configured", &unverified, AutoApproveRules{RequiresIdentityVerification: true}, false},
		{"verified identity satisfies configured requirement", &verified, AutoApproveRules{RequiresIdentityVerification: true}, true},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := meetsAdditionalAutoApproveRules(testCase.signal, testCase.rules); got != testCase.want {
				t.Fatalf("got %v want %v", got, testCase.want)
			}
		})
	}
}

func TestCreatorThresholdsMissingNewFieldsKeepHistoricalDefaults(t *testing.T) {
	thresholds := DefaultCreatorThresholds()
	if err := json.Unmarshal([]byte(`{"autoApprove":{"minimumAccountAgeDays":45},"manualReview":{}}`), &thresholds); err != nil {
		t.Fatal(err)
	}
	if thresholds.AutoApprove.MinimumAccountAgeDays != 45 {
		t.Fatalf("configured field not applied: got %d", thresholds.AutoApprove.MinimumAccountAgeDays)
	}
	if !thresholds.AutoApprove.RequiresVerifiedEmail || thresholds.AutoApprove.MinimumRealFollowers != 1000 || thresholds.AutoApprove.MaximumFraudScore != 30 {
		t.Fatalf("omitted legacy fields lost historical defaults: %+v", thresholds.AutoApprove)
	}
	if thresholds.AutoApprove.RequiresIdentityVerification {
		t.Fatalf("omitted new rules should remain disabled: %+v", thresholds.AutoApprove)
	}
}
