package services_test

import (
	"testing"
	"time"

	"nantty/modules/ads/src/services"
)

func pacingFixture(hour int, spentToday int64) services.PacingInput {
	start := time.Date(2026, 10, 3, 0, 0, 0, 0, time.UTC)
	return services.PacingInput{
		Now: start.Add(time.Duration(hour) * time.Hour), DayStart: start, DayEnd: start.AddDate(0, 0, 1),
		BudgetType: "daily", BudgetMicros: 24_000_000, SpentTodayMicros: spentToday, BurstBps: 12_000, MinimumUpfrontBps: 200,
	}
}

func TestPacingSpreadsDailyBudgetAcrossTheDay(t *testing.T) {
	if !services.DecidePacing(pacingFixture(12, 11_000_000)).Deliver {
		t.Fatal("under the even pace at noon should deliver")
	}
	if decision := services.DecidePacing(pacingFixture(12, 15_000_000)); decision.Deliver || decision.Reason != "paced" {
		t.Fatalf("ahead of pace should wait, got %+v", decision)
	}
}

func TestPacingAllowsSmallUpfrontSpendAtMidnightAndStopsAtBudget(t *testing.T) {
	if !services.DecidePacing(pacingFixture(0, 0)).Deliver {
		t.Fatal("first impression of the day must be allowed")
	}
	if decision := services.DecidePacing(pacingFixture(23, 24_000_000)); decision.Deliver || decision.Reason != "daily_budget_exhausted" {
		t.Fatalf("spent budget must stop delivery, got %+v", decision)
	}
}

func TestPacingLifetimeBudgetSpreadsRemainingAcrossRemainingDays(t *testing.T) {
	input := pacingFixture(23, 0)
	end := input.DayStart.AddDate(0, 0, 4)
	input.BudgetType, input.BudgetMicros, input.SpentLifetimeMicros, input.ScheduleEnd = "lifetime", 100_000_000, 20_000_000, &end
	input.SpentTodayMicros = 20_000_000
	input.SpentLifetimeMicros = 40_000_000
	if decision := services.DecidePacing(input); decision.Deliver || decision.Reason != "daily_budget_exhausted" {
		t.Fatalf("the daily slice of the lifetime budget is 20M, got %+v", decision)
	}
	input.SpentTodayMicros, input.SpentLifetimeMicros = 5_000_000, 25_000_000
	if !services.DecidePacing(input).Deliver {
		t.Fatal("well under the slice should deliver")
	}
	input.SpentLifetimeMicros = 100_000_000
	if decision := services.DecidePacing(input); decision.Reason != "lifetime_budget_exhausted" {
		t.Fatalf("expected lifetime exhaustion, got %+v", decision)
	}
}

func TestPacingWithoutBudgetDelivers(t *testing.T) {
	input := pacingFixture(5, 0)
	input.BudgetMicros = 0
	if !services.DecidePacing(input).Deliver {
		t.Fatal("no budget limit means no pacing")
	}
}

func TestDayWindowFollowsTheAccountTimezone(t *testing.T) {
	lagos, _ := time.LoadLocation("Africa/Lagos")
	start, end := services.DayWindowInLocation(time.Date(2026, 10, 3, 23, 30, 0, 0, time.UTC), lagos)
	if start.UTC().Hour() != 23 || end.Sub(start) != 24*time.Hour {
		t.Fatalf("lagos day starts at 23:00 UTC, got %v", start.UTC())
	}
}
