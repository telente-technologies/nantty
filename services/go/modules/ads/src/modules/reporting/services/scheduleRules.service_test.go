package services

import (
	"testing"
	"time"
)

func at(value string) time.Time {
	parsed, _ := time.Parse(time.RFC3339, value)
	return parsed
}

func TestNextSendIsTheNextSixAmSlotForEachFrequency(t *testing.T) {
	now := at("2026-10-03T09:30:00Z")
	for frequency, want := range map[string]string{"daily": "2026-10-04T06:00:00Z", "weekly": "2026-10-05T06:00:00Z", "monthly": "2026-11-01T06:00:00Z"} {
		if got := NextSendAfter(frequency, now); !got.Equal(at(want)) {
			t.Fatalf("%s: got %s want %s", frequency, got, want)
		}
	}
	if got := NextSendAfter("weekly", at("2026-10-05T06:00:00Z")); !got.Equal(at("2026-10-12T06:00:00Z")) {
		t.Fatalf("a Monday slot must roll to the following Monday, got %s", got)
	}
	if got := NextSendAfter("monthly", at("2026-12-20T00:00:00Z")); !got.Equal(at("2027-01-01T06:00:00Z")) {
		t.Fatalf("december must roll into january, got %s", got)
	}
}

func TestPeriodsCoverCompleteDaysBeforeTheSend(t *testing.T) {
	due := at("2026-10-05T06:00:00Z")
	for frequency, want := range map[string][2]string{"daily": {"2026-10-04", "2026-10-04"}, "weekly": {"2026-09-28", "2026-10-04"}, "monthly": {"2026-09-01", "2026-09-30"}} {
		if from, to := PeriodFor(frequency, due); from != want[0] || to != want[1] {
			t.Fatalf("%s: got %s..%s", frequency, from, to)
		}
	}
}
