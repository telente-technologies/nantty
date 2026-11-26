package auth_test

import (
	"context"
	"database/sql"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	_ "github.com/jackc/pgx/v5/stdlib"

	"nantty/modules/auth/src/container"
	production "nantty/modules/auth/src/modules/developerProduction"
)

func TestProductionWebhookWorkerReportsPersistenceFailures(t *testing.T) {
	t.Setenv("DEVELOPER_WEBHOOK_ENCRYPTION_KEY", "isolated-webhook-worker-test-key")
	databaseURL := os.Getenv("AUTH_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("AUTH_TEST_DATABASE_URL is not configured")
	}
	ctx := context.Background()
	admin, err := sql.Open("pgx", databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	schema := "webhook_worker_" + uuid.NewString()[:8]
	quotedSchema := pgx.Identifier{schema}.Sanitize()
	if _, err := admin.ExecContext(ctx, "CREATE SCHEMA "+quotedSchema); err != nil {
		_ = admin.Close()
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := admin.ExecContext(ctx, "DROP SCHEMA "+quotedSchema+" CASCADE"); err != nil {
			t.Errorf("drop test schema: %v", err)
		}
		_ = admin.Close()
	})
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
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = db.Close() })
	for _, statement := range []string{
		`CREATE TABLE developer_applications (id uuid PRIMARY KEY, organization_id uuid NOT NULL, status text NOT NULL)`,
		`CREATE TABLE developer_production_webhooks (id uuid PRIMARY KEY, application_id uuid NOT NULL, organization_id uuid NOT NULL, url text NOT NULL, signing_secret_ciphertext text, active boolean NOT NULL, verified_at timestamptz, last_delivery_at timestamptz, last_error text)`,
		`CREATE TABLE developer_production_webhook_deliveries (id uuid PRIMARY KEY, webhook_id uuid NOT NULL, application_id uuid NOT NULL, organization_id uuid NOT NULL, event_id uuid NOT NULL, event_type text NOT NULL, payload jsonb NOT NULL, attempt_count integer NOT NULL, status text NOT NULL, next_attempt_at timestamptz NOT NULL, lease_expires_at timestamptz, last_status_code integer, last_error text, delivered_at timestamptz, created_at timestamptz NOT NULL)`,
		`CREATE TABLE developer_business_messages (id uuid PRIMARY KEY, application_id uuid NOT NULL, organization_id uuid NOT NULL, store_id uuid, recipient_account_id uuid NOT NULL, status text NOT NULL)`,
		`CREATE TABLE developer_business_authorizations (application_id uuid NOT NULL, organization_id uuid NOT NULL, store_id uuid NOT NULL, status text NOT NULL, scopes jsonb NOT NULL)`,
		`CREATE TABLE developer_business_consents (application_id uuid NOT NULL, organization_id uuid NOT NULL, recipient_account_id uuid NOT NULL, status text NOT NULL, scopes jsonb NOT NULL)`,
	} {
		if _, err := db.ExecContext(ctx, statement); err != nil {
			t.Fatal(err)
		}
	}
	now := time.Now().UTC().Truncate(time.Microsecond)
	applicationID, organizationID := uuid.New(), uuid.New()
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_applications (id,organization_id,status) VALUES ($1,$2,'approved')`, applicationID, organizationID); err != nil {
		t.Fatal(err)
	}
	webhookID := uuid.New()
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_production_webhooks (id,application_id,organization_id,url,signing_secret_ciphertext,active,verified_at) VALUES ($1,$2,$3,'https://localhost','invalid-ciphertext',true,$4)`, webhookID, applicationID, organizationID, now); err != nil {
		t.Fatal(err)
	}

	firstID := insertDueWebhookDelivery(t, ctx, db, webhookDeliveryFixture{webhookID: webhookID, applicationID: applicationID, organizationID: organizationID, now: now})
	deployed := &container.Container{Database: db, Now: func() time.Time { return now }}
	processed, err := production.DeliverDueWebhooksOnce(ctx, deployed, nil, 10)
	if err != nil || processed != 1 {
		t.Fatalf("worker processed=%d err=%v; want one persisted failure", processed, err)
	}
	var status, lastError string
	var attempts int
	if err := db.QueryRowContext(ctx, `SELECT status,attempt_count,last_error FROM developer_production_webhook_deliveries WHERE id=$1`, firstID).Scan(&status, &attempts, &lastError); err != nil {
		t.Fatal(err)
	}
	if status != "pending" || attempts != 1 || lastError != "webhook signing secret could not be opened" {
		t.Fatalf("failure state=(%q,%d,%q), want pending,1,sanitized reason", status, attempts, lastError)
	}

	secondID := insertDueWebhookDelivery(t, ctx, db, webhookDeliveryFixture{webhookID: webhookID, applicationID: applicationID, organizationID: organizationID, now: now})
	if _, err := db.ExecContext(ctx, `CREATE FUNCTION reject_delivery_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.lease_expires_at IS NULL THEN RAISE EXCEPTION 'persistence unavailable'; END IF; RETURN NEW; END $$`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `CREATE TRIGGER reject_delivery_update BEFORE UPDATE ON developer_production_webhook_deliveries FOR EACH ROW EXECUTE FUNCTION reject_delivery_update()`); err != nil {
		t.Fatal(err)
	}
	processed, err = production.DeliverDueWebhooksOnce(ctx, deployed, nil, 10)
	if err == nil || processed != 1 {
		t.Fatalf("worker processed=%d err=%v; want persistence error", processed, err)
	}
	if _, err := db.ExecContext(ctx, `DROP TRIGGER reject_delivery_update ON developer_production_webhook_deliveries`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `DROP FUNCTION reject_delivery_update()`); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRowContext(ctx, `SELECT status,attempt_count FROM developer_production_webhook_deliveries WHERE id=$1`, secondID).Scan(&status, &attempts); err != nil {
		t.Fatal(err)
	}
	if status != "pending" || attempts != 0 {
		t.Fatalf("failed persistence changed retry row to (%q,%d); want unchanged pending row", status, attempts)
	}
	if _, err := db.ExecContext(ctx, `UPDATE developer_production_webhook_deliveries SET status='failed' WHERE id=$1`, secondID); err != nil {
		t.Fatal(err)
	}

	secret, err := production.SealWebhookSecret("test-signing-secret")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `UPDATE developer_production_webhooks SET url='https://1.1.1.1/webhook', signing_secret_ciphertext=$1 WHERE id=$2`, secret, webhookID); err != nil {
		t.Fatal(err)
	}
	concurrentID := insertDueWebhookDelivery(t, ctx, db, webhookDeliveryFixture{webhookID: webhookID, applicationID: applicationID, organizationID: organizationID, now: now})
	started := make(chan struct{}, 1)
	release := make(chan struct{})
	client := &http.Client{Transport: blockingWebhookTransport{started: started, release: release}}
	firstResult := make(chan workerResult, 1)
	go func() {
		count, err := production.DeliverDueWebhooksOnce(ctx, deployed, client, 1)
		firstResult <- workerResult{count: count, err: err}
	}()
	select {
	case <-started:
	case <-time.After(3 * time.Second):
		t.Fatal("first worker did not begin the claimed webhook request")
	}
	secondCount, secondErr := production.DeliverDueWebhooksOnce(ctx, deployed, client, 1)
	if secondErr != nil || secondCount != 0 {
		t.Fatalf("concurrent worker processed=%d err=%v; want zero claimed deliveries", secondCount, secondErr)
	}
	close(release)
	select {
	case result := <-firstResult:
		if result.err != nil || result.count != 1 {
			t.Fatalf("first worker processed=%d err=%v; want successful delivery", result.count, result.err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("first worker did not finish after release")
	}
	var leaseExpiresAt sql.NullTime
	if err := db.QueryRowContext(ctx, `SELECT status,lease_expires_at FROM developer_production_webhook_deliveries WHERE id=$1`, concurrentID).Scan(&status, &leaseExpiresAt); err != nil {
		t.Fatal(err)
	}
	if status != "delivered" || leaseExpiresAt.Valid {
		t.Fatalf("finished claimed row=(%q, lease valid=%t); want delivered and lease cleared", status, leaseExpiresAt.Valid)
	}

	rotatedWebhookID := uuid.New()
	rotatedCiphertext, err := production.SealWebhookSecret("rotated-signing-secret")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_production_webhooks (id,application_id,organization_id,url,signing_secret_ciphertext,active,verified_at) VALUES ($1,$2,$3,'https://1.1.1.1/webhook',$4,true,$5)`, rotatedWebhookID, applicationID, organizationID, rotatedCiphertext, now); err != nil {
		t.Fatal(err)
	}
	insertDueWebhookDelivery(t, ctx, db, webhookDeliveryFixture{webhookID: rotatedWebhookID, applicationID: applicationID, organizationID: organizationID, now: now})
	if _, err := db.ExecContext(ctx, `CREATE FUNCTION disable_webhook_after_claim() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.lease_expires_at IS NOT NULL THEN UPDATE developer_production_webhooks SET active=false WHERE id=NEW.webhook_id; END IF; RETURN NEW; END $$`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `CREATE TRIGGER disable_webhook_after_claim AFTER UPDATE ON developer_production_webhook_deliveries FOR EACH ROW EXECUTE FUNCTION disable_webhook_after_claim()`); err != nil {
		t.Fatal(err)
	}
	transport := &countingWebhookTransport{}
	processed, err = production.DeliverDueWebhooksOnce(ctx, deployed, &http.Client{Transport: transport}, 1)
	if err != nil || processed != 1 {
		t.Fatalf("revoked delivery processed=%d err=%v; want claimed delivery skipped cleanly", processed, err)
	}
	if calls := transport.calls.Load(); calls != 0 {
		t.Fatalf("webhook sent %d request(s) after deactivation between claim and send; want zero", calls)
	}
}

type workerResult struct {
	count int
	err   error
}

type blockingWebhookTransport struct {
	started chan<- struct{}
	release <-chan struct{}
}

type countingWebhookTransport struct {
	calls atomic.Int32
}

func (transport *countingWebhookTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	transport.calls.Add(1)
	return &http.Response{StatusCode: http.StatusNoContent, Header: make(http.Header), Body: io.NopCloser(strings.NewReader("")), Request: request}, nil
}

func (transport blockingWebhookTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	transport.started <- struct{}{}
	select {
	case <-transport.release:
		return &http.Response{StatusCode: http.StatusNoContent, Header: make(http.Header), Body: io.NopCloser(strings.NewReader("")), Request: request}, nil
	case <-request.Context().Done():
		return nil, request.Context().Err()
	}
}

type webhookDeliveryFixture struct {
	webhookID, applicationID, organizationID uuid.UUID
	eventType, payload                       string
	now                                      time.Time
}

func insertDueWebhookDelivery(t *testing.T, ctx context.Context, db *sql.DB, fixture webhookDeliveryFixture) uuid.UUID {
	t.Helper()
	id := uuid.New()
	if fixture.eventType == "" {
		fixture.eventType = "test.event"
	}
	if fixture.payload == "" {
		fixture.payload = "{}"
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_production_webhook_deliveries (id,webhook_id,application_id,organization_id,event_id,event_type,payload,attempt_count,status,next_attempt_at,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,0,'pending',$8,$8)`, id, fixture.webhookID, fixture.applicationID, fixture.organizationID, uuid.New(), fixture.eventType, fixture.payload, fixture.now.Add(-time.Second)); err != nil {
		t.Fatal(err)
	}
	return id
}
