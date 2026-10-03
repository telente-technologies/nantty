package services

import (
	"testing"

	"zudomart/modules/users/src/generated/ent"
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
