package services

import (
	"testing"
	"time"

	"zudomart/modules/wallet/src/generated/ent"
)

func TestOlderHealthEventsNeverOverrideNewerOnes(t *testing.T) {
	now := time.Date(2026, 10, 4, 12, 0, 0, 0, time.UTC)
	existing := &ent.MonetisationHold{HealthChangedAt: now}
	if !ShouldApplyHealthChange(nil, now) || !ShouldApplyHealthChange(existing, now.Add(time.Minute)) || !ShouldApplyHealthChange(existing, now) {
		t.Fatal("first, newer and replayed events apply")
	}
	if ShouldApplyHealthChange(existing, now.Add(-time.Minute)) {
		t.Fatal("an out-of-order older event must not lift or set a pause")
	}
}
