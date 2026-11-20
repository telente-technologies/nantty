package auth_test

import (
	"database/sql"
	"testing"
	"time"

	developerproduction "nantty/modules/auth/src/modules/developerProduction"
)

func TestEffectiveDeveloperBillingStatus(t *testing.T) {
	now := time.Date(2026, 11, 18, 0, 0, 0, 0, time.UTC)
	future := now.Add(time.Hour)
	past := now.Add(-time.Hour)
	for _, tc := range []struct {
		tier, status, reference string
		end, paymentVerifiedAt  sql.NullTime
		referenceValid          bool
		want                    string
	}{
		{"sandbox", "active", "", sql.NullTime{}, sql.NullTime{}, false, "active"},
		{"starter", "active", "payment-1", sql.NullTime{Time: future, Valid: true}, sql.NullTime{Time: past, Valid: true}, true, "active"},
		{"starter", "active", "payment-1", sql.NullTime{Time: past, Valid: true}, sql.NullTime{Time: future, Valid: true}, true, "expired"},
		{"growth", "active", "payment-1", sql.NullTime{}, sql.NullTime{Time: future, Valid: true}, true, "expired"},
		{"growth", "active", "payment-1", sql.NullTime{Time: future, Valid: true}, sql.NullTime{}, true, "payment_unverified"},
		{"growth", "active", "", sql.NullTime{Time: future, Valid: true}, sql.NullTime{Time: future, Valid: true}, false, "payment_unverified"},
		{"growth", "active", "payment-1", sql.NullTime{Time: future, Valid: true}, sql.NullTime{Time: now.Add(10 * time.Minute), Valid: true}, true, "payment_unverified"},
		{"growth", "past_due", "", sql.NullTime{Time: future, Valid: true}, sql.NullTime{}, false, "past_due"},
	} {
		providerReference := sql.NullString{String: tc.reference, Valid: tc.referenceValid}
		if got := developerproduction.EffectiveBillingStatus(tc.tier, tc.status, tc.end, tc.paymentVerifiedAt, providerReference, now); got != tc.want {
			t.Errorf("%s %s: got %s, want %s", tc.tier, tc.status, got, tc.want)
		}
	}
}
