package auth_test

import (
	"context"
	"database/sql"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib"

	"nantty/modules/auth/src/container"
	adminops "nantty/modules/auth/src/modules/adminDeveloperOps"
	"nantty/platform/staffauth"
)

func TestAdminQuotaAdjustmentCannotGrantOrChangePaidEntitlements(t *testing.T) {
	url := os.Getenv("AUTH_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("AUTH_TEST_DATABASE_URL is not configured")
	}
	db, err := sql.Open("pgx", url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	ctx := context.Background()
	for _, query := range []string{
		`CREATE TEMP TABLE developer_billing_subscriptions (organization_id uuid PRIMARY KEY, plan_tier text NOT NULL, status text NOT NULL, monthly_quota bigint NOT NULL, current_period_end timestamptz, provider_reference text, updated_at timestamptz NOT NULL DEFAULT now())`,
		`CREATE TEMP TABLE developer_organization_audit_logs (id uuid, organization_id uuid, actor_account_id uuid, actor_role text, action text, subject_type text, subject_id text, before_state jsonb, after_state jsonb, created_at timestamptz)`,
	} {
		if _, err := db.ExecContext(ctx, query); err != nil {
			t.Fatal(err)
		}
	}
	orgID, staffID := uuid.New(), uuid.New()
	now := time.Date(2026, 11, 20, 12, 0, 0, 0, time.UTC)
	controller := adminops.Controller{Container: &container.Container{
		Database: db,
		Logger:   slog.New(slog.NewTextHandler(io.Discard, nil)),
		Now:      func() time.Time { return now },
	}}

	missing := callAdminQuotaAdjustment(controller, orgID, staffID, `{"monthlyQuota":500}`)
	if missing.Code != http.StatusNotFound {
		t.Fatalf("missing subscription status=%d, want 404: %s", missing.Code, missing.Body.String())
	}
	var rows int
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM developer_billing_subscriptions`).Scan(&rows); err != nil || rows != 0 {
		t.Fatalf("missing-subscription adjustment created a row: count=%d err=%v", rows, err)
	}

	if _, err := db.ExecContext(ctx, `INSERT INTO developer_billing_subscriptions VALUES ($1,'sandbox','active',10000,NULL,NULL,now())`, orgID); err != nil {
		t.Fatal(err)
	}
	sandbox := callAdminQuotaAdjustment(controller, orgID, staffID, `{"monthlyQuota":500}`)
	if sandbox.Code != http.StatusConflict {
		t.Fatalf("sandbox subscription status=%d, want 409: %s", sandbox.Code, sandbox.Body.String())
	}
	if _, err := db.ExecContext(ctx, `DELETE FROM developer_billing_subscriptions WHERE organization_id=$1`, orgID); err != nil {
		t.Fatal(err)
	}

	periodEnd := now.Add(24 * time.Hour)
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_billing_subscriptions VALUES ($1,'starter','active',1000,$2,'verified-reference',now())`, orgID, periodEnd); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `UPDATE developer_billing_subscriptions SET provider_reference = NULL WHERE organization_id = $1`, orgID); err != nil {
		t.Fatal(err)
	}
	unverified := callAdminQuotaAdjustment(controller, orgID, staffID, `{"monthlyQuota":500}`)
	if unverified.Code != http.StatusConflict {
		t.Fatalf("unverified paid subscription status=%d, want 409: %s", unverified.Code, unverified.Body.String())
	}
	if _, err := db.ExecContext(ctx, `UPDATE developer_billing_subscriptions SET provider_reference = 'verified-reference' WHERE organization_id = $1`, orgID); err != nil {
		t.Fatal(err)
	}
	paidChange := callAdminQuotaAdjustment(controller, orgID, staffID, `{"monthlyQuota":500}`)
	if paidChange.Code != http.StatusOK || !strings.Contains(paidChange.Body.String(), `"planTier":"starter"`) {
		t.Fatalf("active subscription quota adjustment status=%d body=%s", paidChange.Code, paidChange.Body.String())
	}
	var tier, status, reference string
	var quota int64
	var gotEnd time.Time
	if err := db.QueryRowContext(ctx, `SELECT plan_tier,status,monthly_quota,current_period_end,provider_reference FROM developer_billing_subscriptions WHERE organization_id=$1`, orgID).Scan(&tier, &status, &quota, &gotEnd, &reference); err != nil {
		t.Fatal(err)
	}
	if tier != "starter" || status != "active" || quota != 500 || !gotEnd.Equal(periodEnd) || reference != "verified-reference" {
		t.Fatalf("quota adjustment changed entitlement fields: tier=%s status=%s quota=%d end=%s ref=%s", tier, status, quota, gotEnd, reference)
	}
	var auditCount int
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM developer_organization_audit_logs WHERE action='admin.billing.quota_adjusted' AND organization_id=$1`, orgID).Scan(&auditCount); err != nil || auditCount != 1 {
		t.Fatalf("quota adjustment audit count=%d err=%v", auditCount, err)
	}

	paidTierInjection := callAdminQuotaAdjustment(controller, orgID, staffID, `{"planTier":"enterprise","monthlyQuota":5000}`)
	if paidTierInjection.Code != http.StatusBadRequest {
		t.Fatalf("planTier injection status=%d, want 400: %s", paidTierInjection.Code, paidTierInjection.Body.String())
	}
	if err := db.QueryRowContext(ctx, `SELECT plan_tier,monthly_quota FROM developer_billing_subscriptions WHERE organization_id=$1`, orgID).Scan(&tier, &quota); err != nil || tier != "starter" || quota != 500 {
		t.Fatalf("rejected plan change modified subscription: tier=%s quota=%d err=%v", tier, quota, err)
	}
}

func callAdminQuotaAdjustment(controller adminops.Controller, orgID, staffID uuid.UUID, body string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(http.MethodPatch, "/api/v1/admin/developer/organizations/"+orgID.String()+"/quota", strings.NewReader(body))
	request.SetPathValue("organizationID", orgID.String())
	request = request.WithContext(staffauth.ContextWithStaff(request.Context(), staffauth.Staff{Id: staffID.String(), Role: "admin"}))
	response := httptest.NewRecorder()
	controller.UpdateQuota(response, request)
	return response
}
