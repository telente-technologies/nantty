package developerproduction

import (
	"context"
	"database/sql"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"

	"nantty/platform/httpserver"
)

// ReserveProductionRequest serializes an organization's quota decisions and records
// the accepted attempt in the same transaction. The organization row is the lock
// shared by all applications and credentials belonging to that organization.
func ReserveProductionRequest(ctx context.Context, db *sql.DB, orgId, appId, credId uuid.UUID, method, path string) (uuid.UUID, error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return uuid.Nil, err
	}
	defer tx.Rollback()
	var lockedId uuid.UUID
	if err := tx.QueryRowContext(ctx, `SELECT id FROM developer_organizations WHERE id = $1 FOR UPDATE`, orgId).Scan(&lockedId); err != nil {
		return uuid.Nil, err
	}
	id, err := reserveProductionRequestTx(ctx, tx, orgId, appId, credId, method, path)
	if err != nil {
		return uuid.Nil, err
	}
	if err := tx.Commit(); err != nil {
		return uuid.Nil, err
	}
	return id, nil
}

func reserveProductionRequestTx(ctx context.Context, tx *sql.Tx, orgId, appId, credId uuid.UUID, method, path string) (uuid.UUID, error) {
	var quota int64
	var tier, status string
	var periodEnd sql.NullTime
	err := tx.QueryRowContext(ctx,
		`SELECT plan_tier, status, monthly_quota, current_period_end FROM developer_billing_subscriptions WHERE organization_id = $1`, orgId,
	).Scan(&tier, &status, &quota, &periodEnd)
	if err != nil && err != sql.ErrNoRows {
		return uuid.Nil, err
	}
	if err == sql.ErrNoRows || tier == "sandbox" {
		return uuid.Nil, httpserver.NewApiError(http.StatusPaymentRequired, "PRODUCTION_PLAN_REQUIRED", "An active production plan is required for live API requests.")
	}
	if status != "active" || !periodEnd.Valid || !periodEnd.Time.After(time.Now()) {
		return uuid.Nil, httpserver.NewApiError(http.StatusPaymentRequired, "SUBSCRIPTION_INACTIVE", "Production API subscription is inactive or expired.")
	}
	var used int64
	var resetAt time.Time
	if err := tx.QueryRowContext(ctx,
		`SELECT COUNT(*)::bigint, date_trunc('month', now()) + interval '1 month'
		 FROM developer_production_requests
		 WHERE organization_id = $1 AND created_at >= date_trunc('month', now())`, orgId,
	).Scan(&used, &resetAt); err != nil {
		return uuid.Nil, err
	}
	if used >= quota {
		return uuid.Nil, httpserver.NewApiError(http.StatusTooManyRequests, "MONTHLY_QUOTA_EXCEEDED", "Monthly production API quota exceeded.").WithDetails(map[string]any{
			"limit": quota, "remaining": int64(0), "resetAt": resetAt.UTC(),
		})
	}
	id := uuid.New()
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO developer_production_requests (id, application_id, organization_id, credential_id, method, path, status_code, latency_ms, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, 102, 0, now())`, id, appId, orgId, credId, method, path,
	); err != nil {
		return uuid.Nil, err
	}
	return id, nil
}

func completeProductionRequest(ctx context.Context, db *sql.DB, logger *slog.Logger, id uuid.UUID, status int, started time.Time) {
	recordCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 2*time.Second)
	defer cancel()
	if _, err := db.ExecContext(recordCtx,
		`UPDATE developer_production_requests SET status_code = $2, latency_ms = $3 WHERE id = $1`,
		id, status, int(time.Since(started).Milliseconds()),
	); err != nil && logger != nil {
		logger.Error("could not finalize developer production request usage record", "request_id", id, "status_code", status, "error", err)
	}
}

func ProductionUsageCount(ctx context.Context, db *sql.DB, orgId uuid.UUID) (int64, error) {
	var total int64
	err := db.QueryRowContext(ctx,
		`SELECT COUNT(*)::bigint FROM developer_production_requests WHERE organization_id = $1 AND created_at >= date_trunc('month', now())`, orgId,
	).Scan(&total)
	return total, err
}
