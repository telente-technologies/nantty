package auth_test

import (
	"testing"
	"time"

	developerproduction "nantty/modules/auth/src/modules/developerProduction"
)

func TestEffectiveDeveloperBillingStatus(t *testing.T) {
	now := time.Date(2026, 11, 18, 0, 0, 0, 0, time.UTC)
	future := now.Add(time.Hour)
	past := now.Add(-time.Hour)
	for _, tc := range []struct {
		tier, status string
		end          *time.Time
		want         string
	}{
		{"sandbox", "active", nil, "active"},
		{"starter", "active", &future, "active"},
		{"starter", "active", &past, "expired"},
		{"growth", "active", nil, "expired"},
		{"growth", "past_due", &future, "past_due"},
	} {
		if got := developerproduction.EffectiveBillingStatus(tc.tier, tc.status, tc.end, now); got != tc.want {
			t.Errorf("%s %s: got %s, want %s", tc.tier, tc.status, got, tc.want)
		}
	}
}
