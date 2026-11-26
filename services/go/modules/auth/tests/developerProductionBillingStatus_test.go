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

func TestEffectiveMonthlyQuotaRequiresVerifiedActivePaidSubscription(t *testing.T) {
	now := time.Date(2026, 11, 26, 0, 0, 0, 0, time.UTC)
	future := sql.NullTime{Time: now.Add(time.Hour), Valid: true}
	verified := sql.NullTime{Time: now, Valid: true}
	reference := sql.NullString{String: "settled-payment", Valid: true}
	for _, tc := range []struct {
		name, tier, status           string
		periodEnd, paymentVerifiedAt sql.NullTime
		providerReference            sql.NullString
		want                         int64
	}{
		{name: "active verified paid", tier: "starter", status: "active", periodEnd: future, paymentVerifiedAt: verified, providerReference: reference, want: 100000},
		{name: "sandbox", tier: "sandbox", status: "active", want: 0},
		{name: "missing settlement timestamp", tier: "starter", status: "active", periodEnd: future, providerReference: reference, want: 0},
		{name: "missing provider reference", tier: "starter", status: "active", periodEnd: future, paymentVerifiedAt: verified, want: 0},
		{name: "expired period", tier: "starter", status: "active", periodEnd: sql.NullTime{Time: now.Add(-time.Hour), Valid: true}, paymentVerifiedAt: verified, providerReference: reference, want: 0},
		{name: "inactive status", tier: "starter", status: "canceled", periodEnd: future, paymentVerifiedAt: verified, providerReference: reference, want: 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got := developerproduction.EffectiveMonthlyQuota(tc.tier, tc.status, 100000, tc.periodEnd, tc.paymentVerifiedAt, tc.providerReference, now)
			if got != tc.want {
				t.Fatalf("EffectiveMonthlyQuota() = %d, want %d", got, tc.want)
			}
		})
	}
}
