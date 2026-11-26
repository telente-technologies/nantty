package auth_test

import (
	"context"
	"database/sql"
	"encoding/json"
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

func TestAdminDeveloperOperationsRollbackWhenAuditWriteFails(t *testing.T) {
	databaseURL := os.Getenv("AUTH_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("AUTH_TEST_DATABASE_URL is not configured")
	}

	t.Run("quota adjustment", func(t *testing.T) {
		db := openAdminAuditTestDatabase(t, databaseURL)
		for _, statement := range []string{
			`CREATE TEMP TABLE developer_billing_subscriptions (organization_id uuid PRIMARY KEY, plan_tier text NOT NULL, status text NOT NULL, monthly_quota bigint NOT NULL, current_period_end timestamptz, provider_reference text, payment_verified_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now())`,
			`CREATE TEMP TABLE developer_organization_audit_logs (id uuid, organization_id uuid, actor_account_id uuid, actor_role text, action text CHECK (action <> 'admin.billing.quota_adjusted'), subject_type text, subject_id text, before_state jsonb, after_state jsonb, created_at timestamptz)`,
		} {
			if _, err := db.Exec(statement); err != nil {
				t.Fatal(err)
			}
		}
		orgID, staffID := uuid.New(), uuid.New()
		now := time.Now().UTC()
		if _, err := db.Exec(`INSERT INTO developer_billing_subscriptions (organization_id,plan_tier,status,monthly_quota,current_period_end,provider_reference,payment_verified_at) VALUES ($1,'starter','active',1000,$2,'verified-reference',$3)`, orgID, now.Add(time.Hour), now); err != nil {
			t.Fatal(err)
		}
		controller := adminops.Controller{Container: &container.Container{
			Database: db,
			Logger:   slog.New(slog.NewTextHandler(io.Discard, nil)),
			Now:      func() time.Time { return now },
		}}
		response := callAdminQuotaAdjustment(controller, orgID, staffID, `{"monthlyQuota":2000,"reason":"test audit rollback"}`)
		if response.Code != http.StatusInternalServerError {
			t.Fatalf("audit failure response=%d body=%s; want 500", response.Code, response.Body.String())
		}
		var quota int64
		if err := db.QueryRow(`SELECT monthly_quota FROM developer_billing_subscriptions WHERE organization_id=$1`, orgID).Scan(&quota); err != nil {
			t.Fatal(err)
		}
		if quota != 1000 {
			t.Fatalf("unaudited quota change persisted: got %d, want 1000", quota)
		}
	})

	t.Run("application review", func(t *testing.T) {
		db := openAdminAuditTestDatabase(t, databaseURL)
		for _, statement := range []string{
			`CREATE TEMP TABLE developer_applications (id uuid PRIMARY KEY, organization_id uuid NOT NULL, status text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`,
			`CREATE TEMP TABLE developer_organization_audit_logs (id uuid, organization_id uuid, actor_account_id uuid, actor_role text, action text CHECK (action NOT LIKE 'admin.application.%'), subject_type text, subject_id text, before_state jsonb, after_state jsonb, created_at timestamptz)`,
		} {
			if _, err := db.Exec(statement); err != nil {
				t.Fatal(err)
			}
		}
		appID, orgID, staffID := uuid.New(), uuid.New(), uuid.New()
		if _, err := db.Exec(`INSERT INTO developer_applications (id,organization_id,status) VALUES ($1,$2,'pending')`, appID, orgID); err != nil {
			t.Fatal(err)
		}
		controller := adminops.Controller{Container: &container.Container{
			Database: db,
			Logger:   slog.New(slog.NewTextHandler(io.Discard, nil)),
		}}
		request := httptest.NewRequest(http.MethodPost, "/api/v1/admin/developer/applications/"+appID.String()+"/review", strings.NewReader(`{"decision":"approved","reason":"security review passed"}`))
		request.SetPathValue("applicationID", appID.String())
		request = request.WithContext(staffauth.ContextWithStaff(request.Context(), staffauth.Staff{Id: staffID.String(), Role: "admin"}))
		response := httptest.NewRecorder()
		controller.ReviewApplication(response, request)
		if response.Code != http.StatusInternalServerError {
			t.Fatalf("audit failure response=%d body=%s; want 500", response.Code, response.Body.String())
		}
		var status string
		if err := db.QueryRow(`SELECT status FROM developer_applications WHERE id=$1`, appID).Scan(&status); err != nil {
			t.Fatal(err)
		}
		if status != "pending" {
			t.Fatalf("unaudited application review persisted: got %q, want pending", status)
		}
	})
}

func TestAdminApplicationReviewRequiresBoundedReason(t *testing.T) {
	controller := adminops.Controller{Container: &container.Container{Logger: slog.New(slog.NewTextHandler(io.Discard, nil))}}
	appID := uuid.New().String()
	tests := []struct {
		name       string
		decision   string
		reason     string
		wantStatus int
	}{
		{name: "short reason rejected", decision: "approved", reason: "four", wantStatus: http.StatusBadRequest},
		{name: "oversized reason rejected", decision: "approved", reason: strings.Repeat("x", 1001), wantStatus: http.StatusBadRequest},
		{name: "oversized unicode reason rejected", decision: "approved", reason: strings.Repeat("🙂", 1001), wantStatus: http.StatusBadRequest},
		{name: "unknown decision rejected", decision: "archived", reason: "valid reason", wantStatus: http.StatusBadRequest},
		{name: "trimmed five character reason accepted by validation", decision: "approved", reason: "  valid  ", wantStatus: http.StatusUnauthorized},
		{name: "maximum unicode reason accepted by validation", decision: "approved", reason: strings.Repeat("🙂", 1000), wantStatus: http.StatusUnauthorized},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			body := `{"decision":"` + test.decision + `","reason":"` + test.reason + `"}`
			request := httptest.NewRequest(http.MethodPost, "/api/v1/admin/developer/applications/"+appID+"/review", strings.NewReader(body))
			request.SetPathValue("applicationID", appID)
			response := httptest.NewRecorder()
			controller.ReviewApplication(response, request)
			if response.Code != test.wantStatus {
				t.Fatalf("review status=%d body=%s; want %d", response.Code, response.Body.String(), test.wantStatus)
			}
		})
	}
}

func TestAdminQuotaAdjustmentRequiresBoundedReason(t *testing.T) {
	controller := adminops.Controller{Container: &container.Container{Logger: slog.New(slog.NewTextHandler(io.Discard, nil))}}
	orgID := uuid.New().String()
	for _, test := range []struct {
		name   string
		reason string
	}{
		{name: "missing reason"},
		{name: "short reason", reason: "no"},
		{name: "oversized reason", reason: strings.Repeat("x", 1001)},
		{name: "oversized unicode reason", reason: strings.Repeat("🙂", 1001)},
	} {
		t.Run(test.name, func(t *testing.T) {
			body := `{"monthlyQuota":500,"reason":"` + test.reason + `"}`
			request := httptest.NewRequest(http.MethodPatch, "/api/v1/admin/developer/organizations/"+orgID+"/quota", strings.NewReader(body))
			request.SetPathValue("organizationID", orgID)
			response := httptest.NewRecorder()
			controller.UpdateQuota(response, request)
			if response.Code != http.StatusBadRequest {
				t.Fatalf("quota status=%d body=%s; want 400", response.Code, response.Body.String())
			}
		})
	}
}

func TestAdminDeveloperAuditReadIsPaginatedAndOmitsStatePayloads(t *testing.T) {
	databaseURL := os.Getenv("AUTH_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("AUTH_TEST_DATABASE_URL is not configured")
	}
	db := openAdminAuditTestDatabase(t, databaseURL)
	for _, statement := range []string{
		`CREATE TEMP TABLE developer_organizations (id uuid PRIMARY KEY, name text NOT NULL)`,
		`CREATE TEMP TABLE developer_organization_audit_logs (id uuid PRIMARY KEY, organization_id uuid NOT NULL, actor_account_id uuid NOT NULL, actor_role text NOT NULL, action text NOT NULL, subject_type text NOT NULL, subject_id text NOT NULL, before_state jsonb NOT NULL, after_state jsonb NOT NULL, created_at timestamptz NOT NULL)`,
	} {
		if _, err := db.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
	orgID, actorID := uuid.New(), uuid.New()
	olderID, newerID := uuid.New(), uuid.New()
	if _, err := db.Exec(`INSERT INTO developer_organizations VALUES ($1,'Example')`, orgID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO developer_organization_audit_logs VALUES
		($1,$2,$3,'admin','admin.application.approved','developer_application','app-1','{}','{"reason":"private review detail"}',now()-interval '1 minute'),
		($4,$2,$3,'admin','admin.billing.quota_adjusted','developer_organization',$2::text,'{}','{"quota":2000}',now())`, olderID, orgID, actorID, newerID); err != nil {
		t.Fatal(err)
	}
	controller := adminops.Controller{Container: &container.Container{Database: db, Logger: slog.New(slog.NewTextHandler(io.Discard, nil))}}
	request := httptest.NewRequest(http.MethodGet, "/api/v1/admin/developer/audit?limit=1", nil)
	response := httptest.NewRecorder()
	controller.ListAudit(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("audit response=%d body=%s; want 200", response.Code, response.Body.String())
	}
	var first struct {
		Entries    []map[string]any `json:"entries"`
		NextCursor string           `json:"nextCursor"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &first); err != nil {
		t.Fatal(err)
	}
	if len(first.Entries) != 1 || first.Entries[0]["id"] != newerID.String() || first.NextCursor == "" {
		t.Fatalf("unexpected first page: %+v", first)
	}
	if _, exists := first.Entries[0]["afterState"]; exists {
		t.Fatal("audit response exposed arbitrary after-state payload")
	}
	request = httptest.NewRequest(http.MethodGet, "/api/v1/admin/developer/audit?limit=1&cursor="+first.NextCursor, nil)
	response = httptest.NewRecorder()
	controller.ListAudit(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("second page response=%d body=%s; want 200", response.Code, response.Body.String())
	}
	var second struct {
		Entries    []map[string]any `json:"entries"`
		NextCursor string           `json:"nextCursor"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &second); err != nil {
		t.Fatal(err)
	}
	if len(second.Entries) != 1 || second.Entries[0]["id"] != olderID.String() || second.NextCursor != "" {
		t.Fatalf("unexpected second page: %+v", second)
	}
}

func TestAdminDeveloperApplicationListIncludesSubscriptionContext(t *testing.T) {
	databaseURL := os.Getenv("AUTH_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("AUTH_TEST_DATABASE_URL is not configured")
	}
	db := openAdminAuditTestDatabase(t, databaseURL)
	for _, statement := range []string{
		`CREATE TEMP TABLE developer_organizations (id uuid PRIMARY KEY, name text NOT NULL)`,
		`CREATE TEMP TABLE developer_applications (id uuid PRIMARY KEY, organization_id uuid NOT NULL, name text NOT NULL, api_product text NOT NULL, status text NOT NULL, created_at timestamptz NOT NULL)`,
		`CREATE TEMP TABLE developer_billing_subscriptions (organization_id uuid PRIMARY KEY, plan_tier text NOT NULL, status text NOT NULL, monthly_quota bigint NOT NULL, current_period_end timestamptz, payment_verified_at timestamptz)`,
	} {
		if _, err := db.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
	orgID, appID := uuid.New(), uuid.New()
	if _, err := db.Exec(`INSERT INTO developer_organizations VALUES ($1,'Example Org')`, orgID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO developer_applications VALUES ($1,$2,'Store Inbox','business_messaging','approved',now())`, appID, orgID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO developer_billing_subscriptions VALUES ($1,'starter','active',2500,now()+interval '1 day',now())`, orgID); err != nil {
		t.Fatal(err)
	}
	controller := adminops.Controller{Container: &container.Container{Database: db, Logger: slog.New(slog.NewTextHandler(io.Discard, nil))}}
	response := httptest.NewRecorder()
	controller.ListApplications(response, httptest.NewRequest(http.MethodGet, "/api/v1/admin/developer/applications", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("application list response=%d body=%s; want 200", response.Code, response.Body.String())
	}
	var payload struct {
		Applications []struct {
			ID                 string `json:"id"`
			PlanTier           string `json:"planTier"`
			SubscriptionStatus string `json:"subscriptionStatus"`
			MonthlyQuota       int64  `json:"monthlyQuota"`
			PaymentVerified    bool   `json:"paymentVerified"`
		} `json:"applications"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Applications) != 1 {
		t.Fatalf("unexpected application rows: %+v", payload.Applications)
	}
	item := payload.Applications[0]
	if item.ID != appID.String() || item.PlanTier != "starter" || item.SubscriptionStatus != "active" || item.MonthlyQuota != 2500 || !item.PaymentVerified {
		t.Fatalf("application subscription context mismatch: %+v", item)
	}
}

func openAdminAuditTestDatabase(t *testing.T, databaseURL string) *sql.DB {
	t.Helper()
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = db.Close() })
	if err := db.PingContext(context.Background()); err != nil {
		t.Fatal(err)
	}
	return db
}
