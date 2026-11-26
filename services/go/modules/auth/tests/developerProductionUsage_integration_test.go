package auth_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	_ "github.com/jackc/pgx/v5/stdlib"

	"nantty/modules/auth/src/container"
	developerproduction "nantty/modules/auth/src/modules/developerProduction"
	"nantty/platform/jwtauth"
)

func TestDeveloperUsageShowsPaidQuotaOnlyAfterVerifiedSettlement(t *testing.T) {
	databaseURL := os.Getenv("AUTH_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("AUTH_TEST_DATABASE_URL is not configured")
	}
	admin, err := sql.Open("pgx", databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	ctx := context.Background()
	schema := "usage_billing_test_" + uuid.NewString()[:8]
	quotedSchema := pgx.Identifier{schema}.Sanitize()
	if _, err := admin.ExecContext(ctx, "CREATE SCHEMA "+quotedSchema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = admin.ExecContext(ctx, "DROP SCHEMA "+quotedSchema+" CASCADE") })
	parsed, err := url.Parse(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	query := parsed.Query()
	query.Set("search_path", schema)
	parsed.RawQuery = query.Encode()
	db, err := sql.Open("pgx", parsed.String())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	for _, statement := range []string{
		`CREATE TABLE developer_organization_memberships (id uuid PRIMARY KEY, organization_id uuid NOT NULL, account_id uuid NOT NULL, role text NOT NULL)`,
		`CREATE TABLE developer_applications (id uuid PRIMARY KEY, organization_id uuid NOT NULL, status text NOT NULL)`,
		`CREATE TABLE developer_billing_subscriptions (organization_id uuid PRIMARY KEY, plan_tier text NOT NULL, status text NOT NULL, monthly_quota bigint NOT NULL, current_period_end timestamptz, provider_reference text, payment_verified_at timestamptz)`,
		`CREATE TABLE developer_production_requests (id uuid PRIMARY KEY, organization_id uuid NOT NULL, created_at timestamptz NOT NULL)`,
	} {
		if _, err := db.ExecContext(ctx, statement); err != nil {
			t.Fatal(err)
		}
	}
	orgID, appID, accountID := uuid.New(), uuid.New(), uuid.New()
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_organization_memberships VALUES ($1,$2,$3,'owner')`, uuid.New(), orgID, accountID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_applications VALUES ($1,$2,'approved')`, appID, orgID); err != nil {
		t.Fatal(err)
	}
	periodEnd := time.Now().UTC().Add(time.Hour)
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_billing_subscriptions VALUES ($1,'starter','active',100000,$2,'settled-reference',NULL)`, orgID, periodEnd); err != nil {
		t.Fatal(err)
	}
	controller := developerproduction.Controller{Container: &container.Container{Database: db, Logger: slog.New(slog.NewTextHandler(io.Discard, nil))}}
	readQuota := func() int64 {
		t.Helper()
		request := httptest.NewRequest(http.MethodGet, "/", nil)
		request.SetPathValue("organizationID", orgID.String())
		request.SetPathValue("applicationID", appID.String())
		request = request.WithContext(jwtauth.ContextWithPrincipal(request.Context(), jwtauth.Principal{UserId: accountID.String()}))
		response := httptest.NewRecorder()
		controller.GetUsage(response, request)
		if response.Code != http.StatusOK {
			t.Fatalf("usage status=%d, want 200: %s", response.Code, response.Body.String())
		}
		var body struct {
			MonthlyQuota int64 `json:"monthlyQuota"`
		}
		if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		return body.MonthlyQuota
	}
	if got := readQuota(); got != 0 {
		t.Fatalf("paid quota without settlement timestamp=%d, want 0", got)
	}
	if _, err := db.ExecContext(ctx, `UPDATE developer_billing_subscriptions SET payment_verified_at=now() WHERE organization_id=$1`, orgID); err != nil {
		t.Fatal(err)
	}
	if got := readQuota(); got != 100000 {
		t.Fatalf("verified paid quota=%d, want 100000", got)
	}
}
