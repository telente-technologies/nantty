package developerproduction

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
)

func SetSandboxBilling(ctx context.Context, db *sql.DB, orgId uuid.UUID, quota int64) error {
	_, err := db.ExecContext(ctx,
		`INSERT INTO developer_billing_subscriptions (organization_id, plan_tier, status, monthly_quota, provider_reference, current_period_end, updated_at)
		 VALUES ($1, 'sandbox', 'active', $2, NULL, NULL, now())
		 ON CONFLICT (organization_id) DO UPDATE SET plan_tier = 'sandbox', status = 'active', monthly_quota = EXCLUDED.monthly_quota, provider_reference = NULL, current_period_end = NULL, updated_at = now()`,
		orgId, quota,
	)
	return err
}

func EffectiveBillingStatus(tier, status string, periodEnd *time.Time, now time.Time) string {
	if status != "active" || tier == "sandbox" {
		return status
	}
	if periodEnd == nil || !periodEnd.After(now) {
		return "expired"
	}
	return status
}
