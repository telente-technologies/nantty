package loginthrottle

import (
	"testing"
	"time"
)

func TestRepeatedFailuresLockTheIdentifierAndTheLockExpires(t *testing.T) {
	now := time.Date(2026, 10, 10, 12, 0, 0, 0, time.UTC)
	throttle := New(3, 15*time.Minute, 10*time.Minute).WithClock(func() time.Time { return now })
	for attempt := 0; attempt < 2; attempt++ {
		throttle.RecordFailure("victim@example.com")
	}
	if locked := throttle.LockedFor("victim@example.com"); locked != 0 {
		t.Fatalf("locked for %v after 2 failures, want not locked", locked)
	}
	throttle.RecordFailure("victim@example.com")
	if locked := throttle.LockedFor("victim@example.com"); locked != 10*time.Minute {
		t.Fatalf("locked for %v after 3 failures, want 10m", locked)
	}
	if locked := throttle.LockedFor("someone-else@example.com"); locked != 0 {
		t.Fatalf("another identifier is locked for %v", locked)
	}
	now = now.Add(11 * time.Minute)
	if locked := throttle.LockedFor("victim@example.com"); locked != 0 {
		t.Fatalf("lock should expire, still %v", locked)
	}
}

func TestFailuresOutsideTheWindowDoNotAccumulate(t *testing.T) {
	now := time.Date(2026, 10, 10, 12, 0, 0, 0, time.UTC)
	throttle := New(3, time.Minute, time.Hour).WithClock(func() time.Time { return now })
	for attempt := 0; attempt < 5; attempt++ {
		throttle.RecordFailure("slow@example.com")
		throttle.RecordFailure("slow@example.com")
		now = now.Add(2 * time.Minute)
	}
	if locked := throttle.LockedFor("slow@example.com"); locked != 0 {
		t.Fatalf("locked for %v, want failures spread beyond the window to stay unlocked", locked)
	}
}

func TestSuccessClearsTheFailureCount(t *testing.T) {
	throttle := New(2, time.Hour, time.Hour)
	throttle.RecordFailure("user@example.com")
	throttle.RecordSuccess("user@example.com")
	throttle.RecordFailure("user@example.com")
	if locked := throttle.LockedFor("user@example.com"); locked != 0 {
		t.Fatalf("locked for %v, want a success to reset the count", locked)
	}
}
