package auth_test

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"net/url"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	_ "github.com/jackc/pgx/v5/stdlib"

	production "nantty/modules/auth/src/modules/developerProduction"
	"nantty/platform/httpserver"
)

func TestProductionQuotaReservationIsAtomicAcrossConnections(t *testing.T) {
	databaseURL := os.Getenv("AUTH_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("AUTH_TEST_DATABASE_URL is not configured")
	}
	ctx := context.Background()
	admin, err := sql.Open("pgx", databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := "quota_test_" + uuid.NewString()[:8]
	quotedSchema := pgx.Identifier{schema}.Sanitize()
	if _, err := admin.ExecContext(ctx, "CREATE SCHEMA "+quotedSchema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = admin.ExecContext(ctx, "DROP SCHEMA "+quotedSchema+" CASCADE") })
	parsed, err := url.Parse(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	parameters := parsed.Query()
	parameters.Set("search_path", schema)
	parsed.RawQuery = parameters.Encode()
	db, err := sql.Open("pgx", parsed.String())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(8)
	for _, statement := range []string{
		`CREATE TABLE developer_organizations (id uuid PRIMARY KEY)`,
		`CREATE TABLE developer_billing_subscriptions (organization_id uuid PRIMARY KEY, plan_tier text, status text, monthly_quota bigint, current_period_end timestamptz, provider_reference text, payment_verified_at timestamptz, updated_at timestamptz)`,
		`CREATE TABLE developer_production_requests (id uuid PRIMARY KEY, application_id uuid, organization_id uuid, credential_id uuid, method text, path text, status_code integer, latency_ms integer, created_at timestamptz)`,
		`CREATE TABLE developer_business_messages (id uuid PRIMARY KEY, organization_id uuid, application_id uuid, credential_id uuid, recipient_account_id uuid, body_text text, status text, idempotency_key varchar(128), request_hash varchar(64), external_message_id text, created_at timestamptz, updated_at timestamptz, UNIQUE (application_id, idempotency_key))`,
	} {
		if _, err := db.ExecContext(ctx, statement); err != nil {
			t.Fatal(err)
		}
	}
	org, app, cred := uuid.New(), uuid.New(), uuid.New()
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_organizations VALUES ($1)`, org); err != nil {
		t.Fatal(err)
	}
	if _, err := production.ReserveProductionRequest(ctx, db, org, app, cred, "GET", "/api/v1/business/conversations"); !errors.Is(err, httpserver.NewApiError(http.StatusPaymentRequired, "PRODUCTION_PLAN_REQUIRED", "")) {
		t.Fatalf("missing subscription must reject production request, got %v", err)
	}
	if err := production.SetSandboxBilling(ctx, db, org, 10000); err != nil {
		t.Fatal(err)
	}
	if _, err := production.ReserveProductionRequest(ctx, db, org, app, cred, "GET", "/api/v1/business/conversations"); !errors.Is(err, httpserver.NewApiError(http.StatusPaymentRequired, "PRODUCTION_PLAN_REQUIRED", "")) {
		t.Fatalf("sandbox subscription must reject production request, got %v", err)
	}
	if _, err := db.ExecContext(ctx, `UPDATE developer_billing_subscriptions SET plan_tier = 'starter', monthly_quota = 1, current_period_end = $2 WHERE organization_id = $1`, org, time.Now().Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if _, err := production.ReserveProductionRequest(ctx, db, org, app, cred, "GET", "/api/v1/business/conversations"); !errors.Is(err, httpserver.NewApiError(http.StatusPaymentRequired, "PAYMENT_VERIFICATION_REQUIRED", "")) {
		t.Fatalf("paid subscription without verified settlement evidence must reject production request, got %v", err)
	}
	if _, err := db.ExecContext(ctx, `UPDATE developer_billing_subscriptions SET provider_reference = 'verified-reference' WHERE organization_id = $1`, org); err != nil {
		t.Fatal(err)
	}
	if _, err := production.ReserveProductionRequest(ctx, db, org, app, cred, "GET", "/api/v1/business/conversations"); !errors.Is(err, httpserver.NewApiError(http.StatusPaymentRequired, "PAYMENT_VERIFICATION_REQUIRED", "")) {
		t.Fatalf("a reference string without verified settlement must reject production access, got %v", err)
	}
	if _, err := db.ExecContext(ctx, `UPDATE developer_billing_subscriptions SET payment_verified_at = now() WHERE organization_id = $1`, org); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	results := make(chan error, 16)
	for range 16 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := production.ReserveProductionRequest(ctx, db, org, app, cred, "POST", "/api/v1/business/messages")
			results <- err
		}()
	}
	wg.Wait()
	close(results)
	var accepted, rejected int
	var quotaError *httpserver.ApiError
	for err := range results {
		if err == nil {
			accepted++
		} else if errors.Is(err, httpserver.NewApiError(http.StatusTooManyRequests, "MONTHLY_QUOTA_EXCEEDED", "")) {
			rejected++
			if quotaError == nil {
				if !errors.As(err, &quotaError) {
					t.Fatalf("quota error does not expose its API details: %v", err)
				}
			}
		} else {
			t.Fatalf("unexpected reservation error: %v", err)
		}
	}
	if accepted != 1 || rejected != 15 {
		t.Fatalf("accepted=%d rejected=%d, want one accepted and fifteen rejected", accepted, rejected)
	}
	resetAt, resetOk := quotaError.Details["resetAt"].(time.Time)
	if quotaError.Details["limit"] != int64(1) || quotaError.Details["remaining"] != int64(0) || !resetOk || !resetAt.After(time.Now()) {
		t.Fatalf("quota details must include limit, remaining and future reset: %#v", quotaError.Details)
	}
	var recorded int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM developer_production_requests WHERE organization_id = $1`, org).Scan(&recorded); err != nil {
		t.Fatal(err)
	}
	if recorded != 1 {
		t.Fatalf("recorded=%d, want one durable reservation", recorded)
	}
	if _, err := db.ExecContext(ctx, `UPDATE developer_billing_subscriptions SET monthly_quota = 10, current_period_end = now() - interval '1 second' WHERE organization_id = $1`, org); err != nil {
		t.Fatal(err)
	}
	_, err = production.ReserveProductionRequest(ctx, db, org, app, cred, "GET", "/api/v1/business/conversations")
	if !errors.Is(err, httpserver.NewApiError(http.StatusPaymentRequired, "SUBSCRIPTION_INACTIVE", "")) {
		t.Fatalf("expired paid subscription must be rejected, got %v", err)
	}
	if _, err := db.ExecContext(ctx, `UPDATE developer_billing_subscriptions SET monthly_quota = 2, current_period_end = now() + interval '1 hour' WHERE organization_id = $1`, org); err != nil {
		t.Fatal(err)
	}
	recipient := uuid.New()
	messageResults := make(chan production.MessageReservation, 16)
	messageErrors := make(chan error, 16)
	for range 16 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			result, err := production.ReserveProductionMessage(ctx, db, org, app, cred, recipient, "same-key", "hello", time.Now())
			messageResults <- result
			messageErrors <- err
		}()
	}
	wg.Wait()
	close(messageResults)
	close(messageErrors)
	var firstMessage uuid.UUID
	var firstCount, replayCount int
	for result := range messageResults {
		if firstMessage == uuid.Nil {
			firstMessage = result.MessageId
		}
		if result.MessageId != firstMessage || result.MessageId == uuid.Nil {
			t.Fatalf("replay used a different message id: %s vs %s", result.MessageId, firstMessage)
		}
		if result.Replay {
			replayCount++
		} else {
			firstCount++
		}
	}
	for err := range messageErrors {
		if err != nil {
			t.Fatalf("same-key replay failed: %v", err)
		}
	}
	if firstCount != 1 || replayCount != 15 {
		t.Fatalf("first=%d replay=%d, want one message and fifteen replays", firstCount, replayCount)
	}
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM developer_production_requests WHERE organization_id = $1`, org).Scan(&recorded); err != nil {
		t.Fatal(err)
	}
	if recorded != 2 {
		t.Fatalf("recorded=%d, replay must not consume quota", recorded)
	}
	otherApp := uuid.New()
	if _, err := db.ExecContext(ctx,
		`INSERT INTO developer_production_requests (id, application_id, organization_id, credential_id, method, path, status_code, latency_ms, created_at)
		 VALUES ($1, $2, $3, $4, 'GET', '/api/v1/business/conversations', 200, 1, now())`, uuid.New(), otherApp, org, cred,
	); err != nil {
		t.Fatal(err)
	}
	usage, err := production.ProductionUsageCount(ctx, db, org)
	if err != nil || usage != 3 {
		t.Fatalf("organization usage must include other applications: usage=%d err=%v", usage, err)
	}
	_, err = production.ReserveProductionMessage(ctx, db, org, app, cred, recipient, "same-key", "different", time.Now())
	if !errors.Is(err, httpserver.NewApiError(http.StatusConflict, "IDEMPOTENCY_KEY_REUSED", "")) {
		t.Fatalf("changed payload must be rejected, got %v", err)
	}
	if err := production.ConfirmProductionMessageDispatch(ctx, db, uuid.New(), "external-missing", time.Now()); !errors.Is(err, production.ErrMessageDispatchNotConfirmed) {
		t.Fatalf("unpersisted dispatch confirmation must fail, got %v", err)
	}
	if err := production.ConfirmProductionMessageDispatch(ctx, db, firstMessage, "external-1", time.Now()); err != nil {
		t.Fatalf("persist dispatch confirmation: %v", err)
	}
	if err := production.ConfirmProductionMessageDispatch(ctx, db, firstMessage, "external-2", time.Now()); !errors.Is(err, production.ErrMessageDispatchNotConfirmed) {
		t.Fatalf("second dispatch confirmation must not overwrite the first, got %v", err)
	}
	confirmed, err := production.ReserveProductionMessage(ctx, db, org, app, cred, recipient, "same-key", "hello", time.Now())
	if err != nil || !confirmed.Replay || confirmed.Status != "dispatched" || confirmed.ExternalMessageId != "external-1" {
		t.Fatalf("confirmed replay: %+v, %v", confirmed, err)
	}
	if _, err := db.ExecContext(ctx, `UPDATE developer_billing_subscriptions SET provider_reference = 'paid-reference', payment_verified_at = now() WHERE organization_id = $1`, org); err != nil {
		t.Fatal(err)
	}
	if err := production.SetSandboxBilling(ctx, db, org, 10000); err != nil {
		t.Fatal(err)
	}
	var tier, status string
	var periodEnd, providerRef sql.NullString
	if err := db.QueryRowContext(ctx, `SELECT plan_tier, status, current_period_end::text, provider_reference FROM developer_billing_subscriptions WHERE organization_id = $1`, org).Scan(&tier, &status, &periodEnd, &providerRef); err != nil {
		t.Fatal(err)
	}
	if tier != "sandbox" || status != "active" || periodEnd.Valid || providerRef.Valid {
		t.Fatalf("sandbox downgrade retained paid metadata: tier=%s status=%s period=%v reference=%v", tier, status, periodEnd, providerRef)
	}
}
