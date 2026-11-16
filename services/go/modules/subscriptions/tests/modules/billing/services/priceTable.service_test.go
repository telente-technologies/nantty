package services_test

import (
	"testing"
	"time"

	"nantty/modules/subscriptions/src/generated/ent"
	"nantty/modules/subscriptions/src/modules/billing/services"
)

func TestApplyPriceVersionsSelectsActiveVersionAndNextSchedule(t *testing.T) {
	base := services.PlanPriceRow{PlanCode: "blue", CountryCode: "NG", Currency: "NGN", MonthlyAmountMinor: 100, Active: true}
	now := time.Date(2026, time.October, 29, 12, 0, 0, 0, time.UTC)
	versions := []*ent.PlanPriceVersion{
		{Currency: "NGN", MonthlyAmountMinor: 200, Active: true, EffectiveFrom: now.Add(-time.Hour), CreatedByStaffID: "staff-a", ChangeReason: "First approved price"},
		{Currency: "NGN", MonthlyAmountMinor: 300, Active: true, EffectiveFrom: now.Add(time.Hour), CreatedByStaffID: "staff-b", ChangeReason: "Scheduled update"},
	}

	got := services.ApplyPlanPriceVersions(base, versions, now)
	if got.MonthlyAmountMinor != 200 || got.EffectiveFrom != versions[0].EffectiveFrom {
		t.Fatalf("current price = %d at %s, want active version 200 at %s", got.MonthlyAmountMinor, got.EffectiveFrom, versions[0].EffectiveFrom)
	}
	if got.NextEffectiveFrom == nil || !got.NextEffectiveFrom.Equal(versions[1].EffectiveFrom) {
		t.Fatalf("next effective date = %v, want %s", got.NextEffectiveFrom, versions[1].EffectiveFrom)
	}
	if len(got.History) != 2 || got.History[0].ChangeReason != "First approved price" || got.History[1].CreatedByStaffId != "staff-b" {
		t.Fatalf("history did not preserve both immutable change records: %+v", got.History)
	}
}

func TestApplyPriceVersionsHonorsScheduledPause(t *testing.T) {
	base := services.PlanPriceRow{PlanCode: "blue", CountryCode: "NG", Currency: "NGN", MonthlyAmountMinor: 100, Active: true}
	now := time.Date(2026, time.October, 29, 12, 0, 0, 0, time.UTC)
	versions := []*ent.PlanPriceVersion{{Currency: "NGN", MonthlyAmountMinor: 100, Active: false, EffectiveFrom: now}}

	got := services.ApplyPlanPriceVersions(base, versions, now)
	if got.Active {
		t.Fatal("scheduled inactive price should be paused at its effective time")
	}
}
