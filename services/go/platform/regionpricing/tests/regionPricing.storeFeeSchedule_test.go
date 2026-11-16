package regionpricing_test

import (
	"errors"
	. "nantty/platform/regionpricing"
	"testing"
	"time"
)

func exampleStoreFeeSchedule(id string, minimumMonths int, feeBps int64) StoreFeeSchedule {
	return StoreFeeSchedule{
		ID: id, Platform: "ios", CountryCode: "US", ProgramCode: "standard", InstallCohort: "any",
		RecurringSubscription: true, MinimumPaidMonths: minimumMonths, ServiceFeeBps: feeBps,
		EffectiveFrom: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC), SourceURL: "https://developer.apple.com/terms",
		RetrievedAt: time.Date(2026, 10, 29, 0, 0, 0, 0, time.UTC), Approved: true,
	}
}

func TestResolveStoreFeeScheduleUsesSpecificEffectiveSchedule(t *testing.T) {
	base := exampleStoreFeeSchedule("standard", 0, 3_000)
	loyal := exampleStoreFeeSchedule("renewal-after-year", 12, 1_500)
	query := StoreFeeScheduleQuery{
		Platform: "ios", CountryCode: "US", ProgramCode: "standard", InstallCohort: "any",
		RecurringSubscription: true, PaidMonths: 12, At: time.Date(2026, 10, 29, 0, 0, 0, 0, time.UTC),
	}
	got, err := ResolveStoreFeeSchedule([]StoreFeeSchedule{base, loyal}, query)
	if err != nil {
		t.Fatal(err)
	}
	if got.ID != "renewal-after-year" || got.ServiceFeeBps != 1_500 {
		t.Fatalf("resolved schedule %+v; want tenure-specific schedule", got)
	}
}

func TestResolveStoreFeeScheduleRequiresExactCountryProgramAndCohort(t *testing.T) {
	schedule := exampleStoreFeeSchedule("google-new-install", 0, 1_000)
	schedule.Platform, schedule.CountryCode, schedule.ProgramCode, schedule.InstallCohort = "android", "GB", "play-experience", "new"
	query := StoreFeeScheduleQuery{
		Platform: "android", CountryCode: "GB", ProgramCode: "play-experience", InstallCohort: "existing",
		RecurringSubscription: true, At: time.Date(2026, 10, 29, 0, 0, 0, 0, time.UTC),
	}
	_, err := ResolveStoreFeeSchedule([]StoreFeeSchedule{schedule}, query)
	if !errors.Is(err, ErrStoreFeeScheduleMissing) {
		t.Fatalf("error=%v, want missing matching schedule", err)
	}
}

func TestResolveStoreFeeScheduleExcludesDraftExpiredAndNotYetEffective(t *testing.T) {
	draft := exampleStoreFeeSchedule("draft", 0, 1_500)
	draft.Approved = false
	expired := exampleStoreFeeSchedule("expired", 0, 1_500)
	expired.EffectiveUntil = time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	future := exampleStoreFeeSchedule("future", 0, 1_500)
	future.EffectiveFrom = time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC)
	query := StoreFeeScheduleQuery{
		Platform: "ios", CountryCode: "US", ProgramCode: "standard", InstallCohort: "any",
		RecurringSubscription: true, At: time.Date(2026, 10, 29, 0, 0, 0, 0, time.UTC),
	}
	_, err := ResolveStoreFeeSchedule([]StoreFeeSchedule{draft, expired, future}, query)
	if !errors.Is(err, ErrStoreFeeScheduleMissing) {
		t.Fatalf("error=%v, want missing effective approved schedule", err)
	}
}

func TestResolveStoreFeeScheduleRejectsAmbiguousMatches(t *testing.T) {
	first := exampleStoreFeeSchedule("first", 0, 1_500)
	second := exampleStoreFeeSchedule("second", 0, 1_000)
	query := StoreFeeScheduleQuery{
		Platform: "ios", CountryCode: "US", ProgramCode: "standard", InstallCohort: "any",
		RecurringSubscription: true, At: time.Date(2026, 10, 29, 0, 0, 0, 0, time.UTC),
	}
	_, err := ResolveStoreFeeSchedule([]StoreFeeSchedule{first, second}, query)
	if !errors.Is(err, ErrStoreFeeScheduleAmbiguous) {
		t.Fatalf("error=%v, want ambiguous matching schedules", err)
	}
}

func TestValidateStoreFeeScheduleRejectsUnsupportedFeeAndSource(t *testing.T) {
	schedule := exampleStoreFeeSchedule("bad-fees", 0, 6_000)
	schedule.BillingFeeBps = 4_000
	if err := ValidateStoreFeeSchedule(schedule); !errors.Is(err, ErrInvalidStoreFeeSchedule) {
		t.Fatalf("combined 100%% fee error=%v", err)
	}
	schedule = exampleStoreFeeSchedule("bad-source", 0, 1_500)
	schedule.SourceURL = "http://developer.example.invalid/terms"
	if err := ValidateStoreFeeSchedule(schedule); !errors.Is(err, ErrInvalidStoreFeeSchedule) {
		t.Fatalf("non-HTTPS source error=%v", err)
	}
}
