package models

import (
	"testing"
	"time"
)

func TestTrialEligibilityFollowsTheAdminRules(t *testing.T) {
	now := time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	rules := TrialRules{TrialDays: 7, MinimumAccountAgeDays: 7, RequiresVerifiedEmail: true, OnePerPerson: true, OnePerCard: true, OnePerDevice: true, MaximumRiskScore: 50, MinimumCompletedOrders: 2}
	good := TrialSignals{AccountCreatedAt: now.Add(-30 * 24 * time.Hour), EmailVerified: true, CompletedOrders: 5, PlanAllowsTrial: true}
	risky := 80
	calm := 10
	cases := []struct {
		name   string
		mutate func(*TrialSignals)
		want   string
	}{
		{"eligible", func(*TrialSignals) {}, ""},
		{"new account", func(signals *TrialSignals) { signals.AccountCreatedAt = now.Add(-2 * 24 * time.Hour) }, "ACCOUNT_TOO_NEW"},
		{"unverified email", func(signals *TrialSignals) { signals.EmailVerified = false }, "EMAIL_NOT_VERIFIED"},
		{"second trial", func(signals *TrialSignals) { signals.PersonUsedTrial = true }, "TRIAL_ALREADY_USED"},
		{"same device", func(signals *TrialSignals) { signals.DeviceUsedTrial = true }, "DEVICE_ALREADY_USED"},
		{"same card", func(signals *TrialSignals) { signals.CardUsedTrial = true }, "CARD_ALREADY_USED"},
		{"same email on another account", func(signals *TrialSignals) { signals.EmailUsedTrial = true }, "TRIAL_ALREADY_USED"},
		{"risky", func(signals *TrialSignals) { signals.RiskScore = &risky }, "RISK_TOO_HIGH"},
		{"calm score", func(signals *TrialSignals) { signals.RiskScore = &calm }, ""},
		{"too few orders", func(signals *TrialSignals) { signals.CompletedOrders = 1 }, "NOT_ENOUGH_COMPLETED_ORDERS"},
		{"plan without trial", func(signals *TrialSignals) { signals.PlanAllowsTrial = false }, "PLAN_HAS_NO_TRIAL"},
		{"already subscribed", func(signals *TrialSignals) { signals.AlreadySubscribed = true }, "ALREADY_SUBSCRIBED"},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			signals := good
			testCase.mutate(&signals)
			reasons := EvaluateTrialEligibility(rules, signals, now)
			if testCase.want == "" && len(reasons) != 0 || testCase.want != "" && (len(reasons) != 1 || reasons[0].Code != testCase.want) {
				t.Fatalf("reasons %+v", reasons)
			}
		})
	}
	if TrialDaysFor("MONTH_1") != 30 || TrialDaysFor("DAYS_7") != 7 {
		t.Fatal("trial length mapping")
	}
}
