package auth_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	_ "github.com/jackc/pgx/v5/stdlib"

	production "nantty/modules/auth/src/modules/developerProduction"
)

func TestProductionMessageConfirmationAndWebhookOutboxAreAtomic(t *testing.T) {
	databaseURL := os.Getenv("AUTH_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("AUTH_TEST_DATABASE_URL is not configured")
	}
	ctx := context.Background()
	admin, err := sql.Open("pgx", databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	schema := "business_webhook_outbox_" + uuid.NewString()[:8]
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
		`CREATE TABLE developer_business_messages (id uuid PRIMARY KEY, application_id uuid NOT NULL, organization_id uuid NOT NULL, status text NOT NULL, external_message_id text, updated_at timestamptz NOT NULL)`,
		`CREATE TABLE developer_production_webhooks (id uuid PRIMARY KEY, application_id uuid NOT NULL, organization_id uuid NOT NULL, events jsonb NOT NULL, active boolean NOT NULL, verified_at timestamptz)`,
		`CREATE TABLE developer_production_webhook_deliveries (id uuid PRIMARY KEY, webhook_id uuid NOT NULL, application_id uuid NOT NULL, organization_id uuid NOT NULL, event_id uuid NOT NULL, event_type text NOT NULL, payload jsonb NOT NULL, status text NOT NULL, attempt_count integer NOT NULL, next_attempt_at timestamptz NOT NULL, created_at timestamptz NOT NULL)`,
	} {
		if _, err := db.ExecContext(ctx, statement); err != nil {
			t.Fatal(err)
		}
	}

	now := time.Now().UTC().Truncate(time.Microsecond)
	orgID, appID, otherAppID, messageID := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_business_messages VALUES ($1,$2,$3,'accepted',NULL,$4)`, messageID, appID, orgID, now); err != nil {
		t.Fatal(err)
	}
	matchingID, wildcardID, unrelatedID, inactiveID, unverifiedID, foreignID := uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()
	for _, subscription := range []struct {
		id         uuid.UUID
		appID      uuid.UUID
		events     string
		active     bool
		verifiedAt any
	}{
		{matchingID, appID, ` ["business.message.dispatched"] `, true, now},
		{wildcardID, appID, `["*"]`, true, now},
		{unrelatedID, appID, `["business.message.failed"]`, true, now},
		{inactiveID, appID, `[]`, false, now},
		{unverifiedID, appID, `[]`, true, nil},
		{foreignID, otherAppID, `[]`, true, now},
	} {
		if _, err := db.ExecContext(ctx, `INSERT INTO developer_production_webhooks VALUES ($1,$2,$3,$4::jsonb,$5,$6)`, subscription.id, subscription.appID, orgID, subscription.events, subscription.active, subscription.verifiedAt); err != nil {
			t.Fatal(err)
		}
	}
	data := map[string]any{"messageId": messageID.String(), "status": "dispatched"}
	confirm := func() error {
		return production.ConfirmProductionMessageDispatchWithWebhookOutbox(ctx, db, messageID, appID, orgID, "carrier-123", data, now)
	}

	if err := confirm(); err != nil {
		t.Fatalf("confirm dispatched message with webhook outbox: %v", err)
	}
	var status, externalID string
	if err := db.QueryRowContext(ctx, `SELECT status, external_message_id FROM developer_business_messages WHERE id=$1`, messageID).Scan(&status, &externalID); err != nil {
		t.Fatal(err)
	}
	if status != "dispatched" || externalID != "carrier-123" {
		t.Fatalf("message state = (%q,%q), want (dispatched,carrier-123)", status, externalID)
	}
	var count int
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM developer_production_webhook_deliveries`).Scan(&count); err != nil || count != 2 {
		t.Fatalf("delivery count = %d, err=%v; want two matching subscriptions", count, err)
	}
	var eventCount int
	if err := db.QueryRowContext(ctx, `SELECT count(DISTINCT event_id) FROM developer_production_webhook_deliveries`).Scan(&eventCount); err != nil || eventCount != 1 {
		t.Fatalf("distinct event count = %d, err=%v; want one shared event", eventCount, err)
	}
	var rawEnvelope []byte
	if err := db.QueryRowContext(ctx, `SELECT payload FROM developer_production_webhook_deliveries LIMIT 1`).Scan(&rawEnvelope); err != nil {
		t.Fatal(err)
	}
	var envelope map[string]any
	if err := json.Unmarshal(rawEnvelope, &envelope); err != nil {
		t.Fatal(err)
	}
	if envelope["event"] != "business.message.dispatched" || envelope["id"] == "" || envelope["data"] == nil {
		t.Fatalf("unexpected persisted event envelope: %#v", envelope)
	}
	if err := confirm(); err != production.ErrMessageDispatchNotConfirmed {
		t.Fatalf("idempotent confirmation error = %v, want %v", err, production.ErrMessageDispatchNotConfirmed)
	}
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM developer_production_webhook_deliveries`).Scan(&count); err != nil || count != 2 {
		t.Fatalf("replay delivery count = %d, err=%v; want unchanged", count, err)
	}

	rollbackMessageID := uuid.New()
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_business_messages VALUES ($1,$2,$3,'accepted',NULL,$4)`, rollbackMessageID, appID, orgID, now); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `CREATE FUNCTION reject_webhook_outbox_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'outbox unavailable'; END $$; CREATE TRIGGER reject_webhook_outbox BEFORE INSERT ON developer_production_webhook_deliveries FOR EACH ROW EXECUTE FUNCTION reject_webhook_outbox_insert()`); err != nil {
		t.Fatal(err)
	}
	err = production.ConfirmProductionMessageDispatchWithWebhookOutbox(ctx, db, rollbackMessageID, appID, orgID, "carrier-456", data, now)
	if err == nil {
		t.Fatal("confirmation succeeded despite webhook outbox insert failure")
	}
	if _, err := db.ExecContext(ctx, `DROP TRIGGER reject_webhook_outbox ON developer_production_webhook_deliveries; DROP FUNCTION reject_webhook_outbox_insert()`); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRowContext(ctx, `SELECT status FROM developer_business_messages WHERE id=$1`, rollbackMessageID).Scan(&status); err != nil {
		t.Fatal(err)
	}
	if status != "accepted" {
		t.Fatalf("failed outbox transaction left message status %q; want accepted", status)
	}
	if _, err := db.ExecContext(ctx, `DELETE FROM developer_production_webhook_deliveries`); err != nil {
		t.Fatal(err)
	}
	if err := production.ConfirmProductionMessageDispatchWithWebhookOutbox(ctx, db, rollbackMessageID, appID, orgID, "carrier-456", data, now); err != nil {
		t.Fatalf("retry after outbox recovery: %v", err)
	}
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM developer_production_webhook_deliveries`).Scan(&count); err != nil || count != 2 {
		t.Fatalf("recovered outbox delivery count = %d, err=%v; want two", count, err)
	}
}
