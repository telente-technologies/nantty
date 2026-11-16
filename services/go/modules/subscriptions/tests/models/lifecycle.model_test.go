package models_test

import (
	"testing"
	"time"

	"nantty/modules/subscriptions/src/models"
)

func TestBillingChangesDriveTheSubscriptionLifecycle(t *testing.T) {
	now := time.Date(2026, 10, 3, 0, 0, 0, 0, time.UTC)
	cases := []struct {
		name                string
		input               models.LifecycleInput
		status, entitlement string
		firstEvent          string
		grace               bool
	}{
		{"trial starts", models.LifecycleInput{CurrentStatus: "awaiting_card", BillingStatus: "trialing"}, "trialing", "granted", "planTrial.started", false},
		{"trial converts", models.LifecycleInput{CurrentStatus: "trialing", BillingStatus: "active"}, "active", "granted", "planTrial.converted", false},
		{"renewal invoice paid", models.LifecycleInput{CurrentStatus: "active", BillingStatus: "active", EventType: "invoice.update"}, "active", "", "planInvoice.paid", false},
		{"renewal fails, retries run", models.LifecycleInput{CurrentStatus: "active", BillingStatus: "past_due"}, "past_due", "", "planInvoice.paymentFailed", false},
		{"recovery succeeds", models.LifecycleInput{CurrentStatus: "past_due", BillingStatus: "active"}, "active", "granted", "planInvoice.paid", false},
		{"retries run out for gold", models.LifecycleInput{CurrentStatus: "past_due", BillingStatus: "canceled"}, "downgraded", "revoked", "subscription.downgraded", false},
		{"retries run out for black", models.LifecycleInput{CurrentStatus: "past_due", BillingStatus: "canceled", GracePeriodEligible: true, GraceDays: 14, Now: now}, "grace", "graceStarted", "subscription.graceStarted", true},
		{"repeat cancel is a no-op", models.LifecycleInput{CurrentStatus: "downgraded", BillingStatus: "canceled"}, "downgraded", "", "", false},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			outcome := models.ApplyBillingChange(testCase.input)
			first := ""
			if len(outcome.Events) > 0 {
				first = outcome.Events[0]
			}
			if outcome.Status != testCase.status || outcome.Entitlement != testCase.entitlement || first != testCase.firstEvent || (outcome.GraceEndsAt != nil) != testCase.grace {
				t.Fatalf("outcome %+v", outcome)
			}
		})
	}
	graceEnds := now.Add(14 * 24 * time.Hour)
	if models.GraceExpired("grace", &graceEnds, now.Add(13*24*time.Hour)) || !models.GraceExpired("grace", &graceEnds, graceEnds) {
		t.Fatal("black keeps the badge for exactly 14 days")
	}
	if due := models.TrialReminderDueTimes(graceEnds); !due[3].Equal(graceEnds.Add(-72*time.Hour)) || !due[1].Equal(graceEnds.Add(-24*time.Hour)) {
		t.Fatal("reminders at 3 days and 1 day")
	}
}
