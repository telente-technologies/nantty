package services_test

import (
	"testing"
	"time"

	"nantty/modules/moderation/src/modules/copyrightClaims/services"
)

func TestBusinessDaysSkipWeekends(t *testing.T) {
	friday := time.Date(2026, 10, 2, 9, 0, 0, 0, time.UTC)
	if got := services.AddBusinessDays(friday, 1); got.Weekday() != time.Monday || got.Day() != 5 {
		t.Fatalf("one business day after Friday is Monday: %v", got)
	}
	if got := services.AddBusinessDays(friday, services.CounterNoticeRestoreBusinessDays); !got.Equal(time.Date(2026, 10, 16, 9, 0, 0, 0, time.UTC)) {
		t.Fatalf("ten business days after Friday 2 Oct is Friday 16 Oct: %v", got)
	}
}

func TestOnlyPendingOrNeedsInfoClaimsCanBeDecidedAndOnlyPendingNeedsInfo(t *testing.T) {
	for status, want := range map[string]bool{"pending": true, "needs_info": true, "upheld": false, "rejected": false, "counter_notice": false, "restored": false} {
		if services.CanDecide(status) != want {
			t.Errorf("CanDecide(%s)", status)
		}
	}
	if !services.CanRequestInfo("pending") || services.CanRequestInfo("needs_info") {
		t.Fatal("info can only be requested from pending")
	}
}

func TestEmailAndWorkTypeValidation(t *testing.T) {
	if !services.IsValidEmail("owner@label.com") || services.IsValidEmail("not-an-email") || services.IsValidEmail("a b@c.com") {
		t.Fatal("email validation")
	}
	if services.WorkTypeFor("sound", "") != "sound" || services.WorkTypeFor("clip", "") != "video" || services.WorkTypeFor("clip", "image") != "image" || services.WorkTypeFor("clip", "bogus") != "video" {
		t.Fatal("work type falls back from the target type")
	}
}
