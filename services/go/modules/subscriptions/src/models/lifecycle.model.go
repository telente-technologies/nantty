package models

import "time"

type LifecycleInput struct {
	CurrentStatus       string
	BillingStatus       string
	EventType           string
	GracePeriodEligible bool
	GraceDays           int
	Now                 time.Time
}

type LifecycleOutcome struct {
	Status            string
	GraceEndsAt       *time.Time
	Entitlement       string
	Events            []string
	CancelAtPeriodEnd bool
}

func ApplyBillingChange(input LifecycleInput) LifecycleOutcome {
	outcome := LifecycleOutcome{Status: input.CurrentStatus}
	switch input.BillingStatus {
	case "trialing":
		if input.CurrentStatus != "trialing" {
			outcome.Status, outcome.Entitlement, outcome.Events = "trialing", "granted", []string{"planTrial.started"}
		}
	case "active":
		outcome.Status = "active"
		switch input.CurrentStatus {
		case "trialing":
			outcome.Entitlement, outcome.Events = "granted", []string{"planTrial.converted", "planInvoice.paid"}
		case "active":
			if input.EventType == "invoice.update" || input.EventType == "invoice.create" {
				outcome.Events = []string{"planInvoice.paid"}
			}
		default:
			outcome.Entitlement, outcome.Events = "granted", []string{"planInvoice.paid"}
		}
	case "past_due":
		outcome.Status, outcome.Events = "past_due", []string{"planInvoice.paymentFailed"}
	case "non_renewing":
		outcome.CancelAtPeriodEnd = true
	case "canceled":
		if input.GracePeriodEligible && input.CurrentStatus != "grace" && input.CurrentStatus != "expired" {
			graceEnds := input.Now.Add(time.Duration(input.GraceDays) * 24 * time.Hour)
			outcome.Status, outcome.GraceEndsAt, outcome.Entitlement, outcome.Events = "grace", &graceEnds, "graceStarted", []string{"subscription.graceStarted"}
		} else if input.CurrentStatus != "downgraded" && input.CurrentStatus != "expired" && input.CurrentStatus != "grace" {
			outcome.Status, outcome.Entitlement, outcome.Events = "downgraded", "revoked", []string{"subscription.downgraded"}
		}
	}
	return outcome
}

func GraceExpired(status string, graceEndsAt *time.Time, now time.Time) bool {
	return status == "grace" && graceEndsAt != nil && !now.Before(*graceEndsAt)
}

func TrialReminderDueTimes(trialEndsAt time.Time) map[int]time.Time {
	return map[int]time.Time{3: trialEndsAt.Add(-72 * time.Hour), 1: trialEndsAt.Add(-24 * time.Hour)}
}
