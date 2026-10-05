package models

import (
	"testing"
	"time"
)

func TestUpgradeIsProratedAndDowngradeWaits(t *testing.T) {
	start := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 10, 31, 0, 0, 0, 0, time.UTC)
	half := start.Add(15 * 24 * time.Hour)
	result := ProrateUpgrade(ProrationInput{CurrentPeriodPaidMinor: 500_000, NewPeriodPriceMinor: 1_500_000, PeriodStartsAt: start, PeriodEndsAt: end, Now: half})
	if result.UnusedCreditMinor != 250_000 || result.ChargeNowMinor != 500_000 {
		t.Fatalf("pro to business halfway: %+v", result)
	}
	yearly := ProrateUpgrade(ProrationInput{CurrentPeriodPaidMinor: 500_000, NewPeriodPriceMinor: 4_800_000, PeriodStartsAt: start, PeriodEndsAt: end, Now: half, RestartPeriod: true})
	if yearly.ChargeNowMinor != 4_550_000 {
		t.Fatalf("monthly to yearly restarts the period: %+v", yearly)
	}
	if !IsUpgrade(500_000, "month", 1_500_000, "month") || IsUpgrade(1_500_000, "month", 500_000, "month") || !IsUpgrade(500_000, "month", 500_000, "year") || IsUpgrade(400_000, "year", 400_000, "month") {
		t.Fatal("upgrade direction")
	}
}

func TestDunningRetriesThenGraceThenFree(t *testing.T) {
	due := time.Date(2026, 11, 1, 9, 0, 0, 0, time.UTC)
	day := 24 * time.Hour
	want := []struct {
		action string
		at     time.Time
	}{{DunningRetry, due.Add(day)}, {DunningRetry, due.Add(3 * day)}, {DunningRetry, due.Add(5 * day)}, {DunningGrace, due.Add(12 * day)}, {DunningDowngrade, due.Add(12 * day)}}
	for index, expected := range want {
		step := NextDunningStep(due, index+1, false)
		if step.Action != expected.action || !step.At.Equal(expected.at) {
			t.Fatalf("failure %d: %+v", index+1, step)
		}
	}
	trial := []string{DunningRetry, DunningRetry, DunningDowngrade}
	for index, action := range trial {
		if step := NextDunningStep(due, index+1, true); step.Action != action || step.At.After(due.Add(3*day)) {
			t.Fatalf("trial failure %d: %+v", index+1, step)
		}
	}
	if !DowngradeAt(due, true).Equal(due.Add(3*day)) || !DowngradeAt(due, false).Equal(due.Add(12*day)) {
		t.Fatal("downgrade dates")
	}
}

func TestPriceChangesWaitForThirtyDaysNotice(t *testing.T) {
	periodStart := time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC)
	effective := time.Date(2026, 12, 1, 0, 0, 0, 0, time.UTC)
	base := RenewalPriceInput{LockedPeriodPriceMinor: 500_000, LockedCurrency: "NGN", BookPeriodPriceMinor: 600_000, BookCurrency: "NGN", PeriodStartsAt: periodStart}
	if decision := DecideRenewalPrice(base); decision.PeriodPriceMinor != 500_000 || !decision.Grandfathered || !decision.NoticeNeeded {
		t.Fatalf("no notice yet: %+v", decision)
	}
	noticed := base
	noticed.NoticedPriceMinor, noticed.NoticeEffectiveAt = 600_000, &effective
	if decision := DecideRenewalPrice(noticed); decision.PeriodPriceMinor != 500_000 || decision.NoticeNeeded {
		t.Fatalf("noticed but not effective yet: %+v", decision)
	}
	noticed.PeriodStartsAt = effective
	if decision := DecideRenewalPrice(noticed); decision.PeriodPriceMinor != 600_000 {
		t.Fatalf("effective: %+v", decision)
	}
	cheaper := base
	cheaper.BookPeriodPriceMinor = 400_000
	if decision := DecideRenewalPrice(cheaper); decision.PeriodPriceMinor != 400_000 || decision.Grandfathered {
		t.Fatalf("price drops apply at once: %+v", decision)
	}
	noticeAt := time.Date(2026, 10, 20, 0, 0, 0, 0, time.UTC)
	if at := PriceChangeEffectiveAt(noticeAt, periodStart, 1, "month"); !at.Equal(effective) {
		t.Fatalf("first renewal at least 30 days after the notice: %s", at)
	}
}

func TestPeriodsKeepTheirAnchorDayAndCardsExpire(t *testing.T) {
	jan31 := time.Date(2027, 1, 31, 9, 0, 0, 0, time.UTC)
	feb := NextPeriodEnd(jan31, 31, "month")
	if feb.Day() != 28 || NextPeriodEnd(feb, 31, "month").Day() != 31 {
		t.Fatalf("anchor day lost: %s", feb)
	}
	if year := NextPeriodEnd(jan31, 31, "year"); year.Year() != 2028 || year.Month() != time.January {
		t.Fatalf("yearly: %s", year)
	}
	next := time.Date(2026, 12, 2, 0, 0, 0, 0, time.UTC)
	if !CardExpiresBefore(11, 2026, next) || CardExpiresBefore(12, 2026, next) {
		t.Fatal("card valid through its expiry month")
	}
	if !CardExpiryNoticeDue(11, 2026, next, next.Add(-10*24*time.Hour)) || CardExpiryNoticeDue(11, 2026, next, next.Add(-40*24*time.Hour)) {
		t.Fatal("card expiry notice window")
	}
}

func TestRenewalIdempotencyIsPerSubscriptionAndPeriod(t *testing.T) {
	start := time.Date(2026, 11, 1, 9, 0, 0, 0, time.UTC)
	key := RenewalIdempotencyKey("sub-1", start)
	if key != RenewalIdempotencyKey("sub-1", start.In(time.FixedZone("WAT", 3600))) || key == RenewalIdempotencyKey("sub-1", start.AddDate(0, 1, 0)) || key == RenewalIdempotencyKey("sub-2", start) {
		t.Fatal("one key per subscription and period")
	}
	first := RenewalChargeReference(key, 1)
	if first != RenewalChargeReference(key, 1) || first == RenewalChargeReference(key, 2) || len(first) != 36 || first[:4] != "ren-" {
		t.Fatalf("charge reference: %s", first)
	}
}
