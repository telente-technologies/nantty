package developerproduction

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"github.com/google/uuid"
)

func SetSandboxBilling(ctx context.Context, db *sql.DB, orgId uuid.UUID, quota int64) error {
	_, err := db.ExecContext(ctx,
		`INSERT INTO developer_billing_subscriptions (organization_id, plan_tier, status, monthly_quota, provider_reference, current_period_end, payment_verified_at, updated_at)
		 VALUES ($1, 'sandbox', 'active', $2, NULL, NULL, NULL, now())
		 ON CONFLICT (organization_id) DO UPDATE SET plan_tier = 'sandbox', status = 'active', monthly_quota = EXCLUDED.monthly_quota, provider_reference = NULL, current_period_end = NULL, payment_verified_at = NULL, updated_at = now()`,
		orgId, quota,
	)
	return err
}

func IsVerifiedPaidSubscription(tier, status string, periodEnd, paymentVerifiedAt sql.NullTime, providerReference sql.NullString, now time.Time) bool {
	return tier != "sandbox" &&
		status == "active" &&
		periodEnd.Valid && periodEnd.Time.After(now) &&
		paymentVerifiedAt.Valid && !paymentVerifiedAt.Time.After(now.Add(5*time.Minute)) &&
		providerReference.Valid && strings.TrimSpace(providerReference.String) != ""
}

func EffectiveMonthlyQuota(tier, status string, quota int64, periodEnd, paymentVerifiedAt sql.NullTime, providerReference sql.NullString, now time.Time) int64 {
	if !IsVerifiedPaidSubscription(tier, status, periodEnd, paymentVerifiedAt, providerReference, now) {
		return 0
	}
	return quota
}

func EffectiveBillingStatus(tier, status string, periodEnd, paymentVerifiedAt sql.NullTime, providerReference sql.NullString, now time.Time) string {
	if status != "active" || tier == "sandbox" {
		return status
	}
	if !periodEnd.Valid || !periodEnd.Time.After(now) {
		return "expired"
	}
	if !IsVerifiedPaidSubscription(tier, status, periodEnd, paymentVerifiedAt, providerReference, now) {
		return "payment_unverified"
	}
	return status
}
