package services

import (
	"testing"
	"time"
)

func TestBusinessDaysSkipWeekends(t *testing.T) {
	friday := time.Date(2026, 10, 2, 9, 0, 0, 0, time.UTC)
	if got := AddBusinessDays(friday, 1); got.Weekday() != time.Monday || got.Day() != 5 {
		t.Fatalf("one business day after Friday is Monday: %v", got)
	}
	if got := AddBusinessDays(friday, CounterNoticeRestoreBusinessDays); !got.Equal(time.Date(2026, 10, 16, 9, 0, 0, 0, time.UTC)) {
		t.Fatalf("ten business days after Friday 2 Oct is Friday 16 Oct: %v", got)
	}
}

func TestOnlyPendingOrNeedsInfoClaimsCanBeDecidedAndOnlyPendingNeedsInfo(t *testing.T) {
	for status, want := range map[string]bool{"pending": true, "needs_info": true, "upheld": false, "rejected": false, "counter_notice": false, "restored": false} {
		if CanDecide(status) != want {
			t.Errorf("CanDecide(%s)", status)
		}
	}
	if !CanRequestInfo("pending") || CanRequestInfo("needs_info") {
		t.Fatal("info can only be requested from pending")
	}
}

func TestEmailAndWorkTypeValidation(t *testing.T) {
	if !IsValidEmail("owner@label.com") || IsValidEmail("not-an-email") || IsValidEmail("a b@c.com") {
		t.Fatal("email validation")
	}
	if WorkTypeFor("sound", "") != "sound" || WorkTypeFor("clip", "") != "video" || WorkTypeFor("clip", "image") != "image" || WorkTypeFor("clip", "bogus") != "video" {
		t.Fatal("work type falls back from the target type")
	}
}
