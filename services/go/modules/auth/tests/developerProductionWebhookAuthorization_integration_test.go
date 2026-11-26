package auth_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	_ "github.com/jackc/pgx/v5/stdlib"

	"nantty/modules/auth/src/container"
	production "nantty/modules/auth/src/modules/developerProduction"
)

func TestProductionWebhookWorkerRevalidatesBusinessAuthorization(t *testing.T) {
	t.Setenv("DEVELOPER_WEBHOOK_ENCRYPTION_KEY", "isolated-webhook-authorization-test-key")
	databaseURL := os.Getenv("AUTH_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("AUTH_TEST_DATABASE_URL is not configured")
	}
	ctx := context.Background()
	admin, err := sql.Open("pgx", databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	schema := "webhook_auth_" + uuid.NewString()[:8]
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
		`CREATE TABLE developer_business_consents (application_id uuid NOT NULL, organization_id uuid NOT NULL, store_id uuid, recipient_account_id uuid NOT NULL, status text NOT NULL, scopes jsonb NOT NULL)`,
	} {
		if _, err := db.ExecContext(ctx, statement); err != nil {
			t.Fatal(err)
		}
	}
	now := time.Now().UTC().Truncate(time.Microsecond)
	appSuspend := insertAuthorizedWebhookEvent(t, ctx, db, now, "suspend_app")
	grantRevoke := insertAuthorizedWebhookEvent(t, ctx, db, now, "revoke_store")
	insertDueWebhookDelivery(t, ctx, db, appSuspend)
	insertDueWebhookDelivery(t, ctx, db, grantRevoke)
	trigger := `CREATE FUNCTION invalidate_business_access_after_claim() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN
			IF NEW.lease_expires_at IS NOT NULL THEN
				IF NEW.payload #>> '{data,reason}' = 'suspend_app' THEN
					UPDATE developer_applications SET status='suspended' WHERE id=NEW.application_id;
				ELSIF NEW.payload #>> '{data,reason}' = 'revoke_store' THEN
					UPDATE developer_business_authorizations SET status='revoked'
					WHERE application_id=NEW.application_id
					  AND store_id=(SELECT store_id FROM developer_business_messages WHERE id::text=NEW.payload #>> '{data,messageId}');
				END IF;
			END IF;
			RETURN NEW;
		END
	$$`
	if _, err := db.ExecContext(ctx, trigger); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `CREATE TRIGGER invalidate_business_access_after_claim AFTER UPDATE ON developer_production_webhook_deliveries FOR EACH ROW EXECUTE FUNCTION invalidate_business_access_after_claim()`); err != nil {
		t.Fatal(err)
	}
	transport := &countingWebhookTransport{}
	deployed := &container.Container{Database: db, Now: func() time.Time { return now }}
	processed, err := production.DeliverDueWebhooksOnce(ctx, deployed, &http.Client{Transport: transport}, 2)
	if err != nil || processed != 2 {
		t.Fatalf("worker processed=%d err=%v; want both claimed events checked", processed, err)
	}
	if calls := transport.calls.Load(); calls != 0 {
		t.Fatalf("worker sent %d request(s) after app suspension/store grant revocation; want zero", calls)
	}
	var appStatus, grantStatus string
	if err := db.QueryRowContext(ctx, `SELECT status FROM developer_applications WHERE id=$1`, appSuspend.applicationID).Scan(&appStatus); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRowContext(ctx, `SELECT status FROM developer_business_authorizations WHERE application_id=$1`, grantRevoke.applicationID).Scan(&grantStatus); err != nil {
		t.Fatal(err)
	}
	if appStatus != "suspended" || grantStatus != "revoked" {
		t.Fatalf("trigger state app=%q grant=%q; want suspended/revoked", appStatus, grantStatus)
	}
}

func insertAuthorizedWebhookEvent(t *testing.T, ctx context.Context, db *sql.DB, now time.Time, reason string) webhookDeliveryFixture {
	t.Helper()
	appID, orgID := uuid.New(), uuid.New()
	webhookID, storeID, recipientID, messageID := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_applications (id,organization_id,status) VALUES ($1,$2,'approved')`, appID, orgID); err != nil {
		t.Fatal(err)
	}
	secret, err := production.SealWebhookSecret("authorization-regression-secret")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_production_webhooks (id,application_id,organization_id,url,signing_secret_ciphertext,active,verified_at) VALUES ($1,$2,$3,'https://1.1.1.1/webhook',$4,true,$5)`, webhookID, appID, orgID, secret, now); err != nil {
		t.Fatal(err)
	}
	for _, statement := range []struct {
		query string
		args  []any
	}{
		{`INSERT INTO developer_business_messages (id,application_id,organization_id,store_id,recipient_account_id,status) VALUES ($1,$2,$3,$4,$5,'dispatched')`, []any{messageID, appID, orgID, storeID, recipientID}},
		{`INSERT INTO developer_business_authorizations (application_id,organization_id,store_id,status,scopes) VALUES ($1,$2,$3,'active','["messages:send"]'::jsonb)`, []any{appID, orgID, storeID}},
		{`INSERT INTO developer_business_consents (application_id,organization_id,store_id,recipient_account_id,status,scopes) VALUES ($1,$2,$3,$4,'active','["messages:send"]'::jsonb)`, []any{appID, orgID, storeID, recipientID}},
	} {
		if _, err := db.ExecContext(ctx, statement.query, statement.args...); err != nil {
			t.Fatal(err)
		}
	}
	payload, err := json.Marshal(map[string]any{"data": map[string]string{"messageId": messageID.String(), "reason": reason}})
	if err != nil {
		t.Fatal(err)
	}
	return webhookDeliveryFixture{
		webhookID: webhookID, applicationID: appID, organizationID: orgID,
		eventType: "business.message.dispatched", payload: string(payload), now: now,
	}
}
