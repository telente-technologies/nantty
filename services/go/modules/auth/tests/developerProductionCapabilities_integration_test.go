package auth_test

import (
	"context"
	"database/sql"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib"

	"nantty/modules/auth/src/container"
	production "nantty/modules/auth/src/modules/developerProduction"
)

func TestProductionResourcesRequireApplicationCapabilities(t *testing.T) {
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
		`CREATE TEMP TABLE developer_applications (id uuid, organization_id uuid, name text, status text)`,
		`CREATE TEMP TABLE developer_organization_memberships (id uuid, organization_id uuid, account_id uuid, role text)`,
		`CREATE TEMP TABLE developer_application_member_grants (organization_id uuid, application_id uuid, membership_id uuid, capability text)`,
		`CREATE TEMP TABLE developer_production_credentials (id uuid PRIMARY KEY, application_id uuid, organization_id uuid, name text, prefix text, secret_hash text, scopes jsonb, status text, created_by_account_id uuid, created_at timestamptz, revoked_at timestamptz)`,
		`CREATE TEMP TABLE developer_production_webhooks (id uuid PRIMARY KEY, application_id uuid, organization_id uuid, url text, events jsonb, signing_secret_preview text, signing_secret_hash text, signing_secret_ciphertext text, active boolean, created_at timestamptz, updated_at timestamptz, verified_at timestamptz, last_error text)`,
		`CREATE TEMP TABLE developer_organization_audit_logs (id uuid, organization_id uuid, actor_account_id uuid, actor_role text, action text, subject_type text, subject_id text, before_state jsonb, after_state jsonb, created_at timestamptz)`,
	} {
		if _, err := db.ExecContext(ctx, query); err != nil {
			t.Fatal(err)
		}
	}
	org, app, owner, developer, analyst, billing, outsider := uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_applications VALUES ($1, $2, 'Example', 'approved')`, app, org); err != nil {
		t.Fatal(err)
	}
	developerMembership := uuid.New()
	for _, member := range []struct {
		id, account uuid.UUID
		role        string
	}{
		{uuid.New(), owner, "owner"}, {developerMembership, developer, "developer"}, {uuid.New(), analyst, "analyst"}, {uuid.New(), billing, "billing"},
	} {
		if _, err := db.ExecContext(ctx, `INSERT INTO developer_organization_memberships VALUES ($1,$2,$3,$4)`, member.id, org, member.account, member.role); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_application_member_grants VALUES ($1,$2,$3,'credentials.manage')`, org, app, developerMembership); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_application_member_grants VALUES ($1,$2,$3,'webhooks.manage')`, org, app, developerMembership); err != nil {
		t.Fatal(err)
	}
	resource := production.Store{Container: &container.Container{Database: db}}
	for _, tc := range []struct {
		name       string
		actor      uuid.UUID
		capability string
		allow      bool
	}{
		{"owner", owner, "credentials.manage", true},
		{"granted developer", developer, "credentials.manage", true},
		{"granted developer webhook manager", developer, "webhooks.manage", true},
		{"ungranted developer", developer, "request_logs.read", false},
		{"analyst", analyst, "credentials.manage", false},
		{"billing", billing, "credentials.manage", false},
		{"outsider", outsider, "credentials.manage", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, _, _, err := resource.RequireMemberAndApprovedApp(ctx, tc.actor.String(), org.String(), app.String(), tc.capability, true)
			if (err == nil) != tc.allow {
				t.Fatalf("allow=%v, error=%v; want allow=%v", err == nil, err, tc.allow)
			}
		})
	}

	credentialID := uuid.New()
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_production_credentials VALUES ($1,$2,$3,'live key','ntlive_old','old-hash','["messages:send"]'::jsonb,'active',$4,now(),NULL)`, credentialID, app, org, owner); err != nil {
		t.Fatal(err)
	}
	credentialStore := production.Store{Container: &container.Container{Database: db, Now: func() time.Time { return time.Date(2026, 11, 19, 0, 0, 0, 0, time.UTC) }}}
	if _, _, err := credentialStore.RotateCredential(ctx, org, app, credentialID, analyst.String()); err == nil {
		t.Fatal("analyst without credentials.manage rotated a production credential")
	}
	var oldStatus string
	if err := db.QueryRowContext(ctx, `SELECT status FROM developer_production_credentials WHERE id = $1`, credentialID).Scan(&oldStatus); err != nil || oldStatus != "active" {
		t.Fatalf("unauthorized rotation changed old credential status=%q err=%v; want active", oldStatus, err)
	}
	rotated, secret, err := credentialStore.RotateCredential(ctx, org, app, credentialID, owner.String())
	if err != nil {
		t.Fatalf("rotate credential: %v", err)
	}
	if rotated.Id == credentialID.String() || rotated.Status != "active" || !strings.HasPrefix(secret, "ntlive_") {
		t.Fatalf("unexpected replacement: credential=%+v secretPrefix=%q", rotated, secret[:min(len(secret), 7)])
	}
	if err := db.QueryRowContext(ctx, `SELECT status FROM developer_production_credentials WHERE id = $1`, credentialID).Scan(&oldStatus); err != nil || oldStatus != "revoked" {
		t.Fatalf("old credential status=%q err=%v; want revoked", oldStatus, err)
	}
	var auditCount int
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM developer_organization_audit_logs WHERE action = 'credential.rotated' AND subject_id = $1`, rotated.Id).Scan(&auditCount); err != nil || auditCount != 1 {
		t.Fatalf("rotation audit count=%d err=%v; want 1", auditCount, err)
	}
	created, createdSecret, err := credentialStore.CreateCredential(ctx, org, app, developer.String(), "developer key", []string{"messages:send"})
	if err != nil {
		t.Fatalf("granted developer create: %v", err)
	}
	if created.Status != "active" || !strings.HasPrefix(createdSecret, "ntlive_") {
		t.Fatalf("unexpected created credential: %+v", created)
	}
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM developer_organization_audit_logs WHERE action = 'credential.created' AND subject_id = $1`, created.Id).Scan(&auditCount); err != nil || auditCount != 1 {
		t.Fatalf("creation audit count=%d err=%v; want 1", auditCount, err)
	}
	if err := credentialStore.RevokeCredential(ctx, org, app, uuid.MustParse(created.Id), developer.String()); err != nil {
		t.Fatalf("granted developer revoke: %v", err)
	}
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM developer_organization_audit_logs WHERE action = 'credential.revoked' AND subject_id = $1`, created.Id).Scan(&auditCount); err != nil || auditCount != 1 {
		t.Fatalf("revocation audit count=%d err=%v; want 1", auditCount, err)
	}
	if _, err := db.ExecContext(ctx, `DELETE FROM developer_application_member_grants WHERE organization_id = $1 AND application_id = $2 AND membership_id = $3 AND capability = 'credentials.manage'`, org, app, developerMembership); err != nil {
		t.Fatal(err)
	}
	var credentialsBefore int
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM developer_production_credentials`).Scan(&credentialsBefore); err != nil {
		t.Fatal(err)
	}
	if _, _, err := credentialStore.CreateCredential(ctx, org, app, developer.String(), "revoked grant", []string{"messages:send"}); err == nil {
		t.Fatal("developer without a current application grant created a credential")
	}
	if err := credentialStore.RevokeCredential(ctx, org, app, uuid.MustParse(rotated.Id), developer.String()); err == nil {
		t.Fatal("developer without a current application grant revoked a credential")
	}
	var credentialsAfter int
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM developer_production_credentials`).Scan(&credentialsAfter); err != nil || credentialsAfter != credentialsBefore {
		t.Fatalf("unauthorized credential mutation changed row count from %d to %d (err=%v)", credentialsBefore, credentialsAfter, err)
	}
	if _, err := db.ExecContext(ctx, `CREATE FUNCTION pg_temp.reject_credential_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action IN ('credential.created', 'credential.revoked') THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `CREATE TRIGGER reject_credential_audit BEFORE INSERT ON developer_organization_audit_logs FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_credential_audit()`); err != nil {
		t.Fatal(err)
	}
	if _, _, err := credentialStore.CreateCredential(ctx, org, app, owner.String(), "audit failure", []string{"messages:send"}); err == nil {
		t.Fatal("credential creation succeeded when its audit write failed")
	}
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM developer_production_credentials`).Scan(&credentialsAfter); err != nil || credentialsAfter != credentialsBefore {
		t.Fatalf("failed create audit left credentials: before=%d after=%d err=%v", credentialsBefore, credentialsAfter, err)
	}
	if err := credentialStore.RevokeCredential(ctx, org, app, uuid.MustParse(rotated.Id), owner.String()); err == nil {
		t.Fatal("credential revocation succeeded when its audit write failed")
	}
	if _, err := db.ExecContext(ctx, `DROP TRIGGER reject_credential_audit ON developer_organization_audit_logs`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `DROP FUNCTION pg_temp.reject_credential_audit()`); err != nil {
		t.Fatal(err)
	}
	var unchangedStatus string
	if err := db.QueryRowContext(ctx, `SELECT status FROM developer_production_credentials WHERE id = $1`, rotated.Id).Scan(&unchangedStatus); err != nil || unchangedStatus != "active" {
		t.Fatalf("failed revoke audit changed credential status=%q err=%v; want active", unchangedStatus, err)
	}
	webhook, firstSecret, err := credentialStore.CreateWebhook(ctx, org, app, developer.String(), "https://8.8.8.8/hooks", []string{"message.created"})
	if err != nil {
		t.Fatalf("granted developer create webhook: %v", err)
	}
	var storedCiphertext string
	if err := db.QueryRowContext(ctx, `SELECT signing_secret_ciphertext FROM developer_production_webhooks WHERE id=$1`, webhook.Id).Scan(&storedCiphertext); err != nil {
		t.Fatal(err)
	}
	openedSecret, err := production.OpenWebhookSecret(storedCiphertext)
	if err != nil || openedSecret != firstSecret {
		t.Fatalf("webhook secret custody mismatch: opened=%q err=%v", openedSecret, err)
	}
	rotatedSecret, rotatedPreview, err := credentialStore.RotateWebhookSecret(ctx, org, app, uuid.MustParse(webhook.Id), developer.String())
	if err != nil || rotatedSecret == firstSecret || rotatedPreview == webhook.SigningSecretPreview {
		t.Fatalf("webhook secret rotation failed: secretChanged=%v previewChanged=%v err=%v", rotatedSecret != firstSecret, rotatedPreview != webhook.SigningSecretPreview, err)
	}
	targetURL, ciphertext, err := credentialStore.PrepareWebhookVerification(ctx, org, app, uuid.MustParse(webhook.Id), developer.String())
	if err != nil || targetURL != webhook.Url || ciphertext == "" {
		t.Fatalf("authorized webhook verification preparation failed: target=%q ciphertextEmpty=%v err=%v", targetURL, ciphertext == "", err)
	}
	if _, _, err := credentialStore.PrepareWebhookVerification(ctx, org, app, uuid.MustParse(webhook.Id), analyst.String()); err == nil {
		t.Fatal("analyst without webhook capability prepared verification")
	}
	if err := credentialStore.RecordWebhookVerification(ctx, org, app, uuid.MustParse(webhook.Id), developer.String(), "verified"); err != nil {
		t.Fatalf("record webhook verification success: %v", err)
	}
	if err := credentialStore.RecordWebhookVerification(ctx, org, app, uuid.MustParse(webhook.Id), developer.String(), "challenge_mismatch"); err != nil {
		t.Fatalf("record webhook verification failure: %v", err)
	}
	if err := credentialStore.DeleteWebhook(ctx, org, app, uuid.MustParse(webhook.Id), developer.String()); err != nil {
		t.Fatalf("granted developer delete webhook: %v", err)
	}
	var webhookAuditCount int
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM developer_organization_audit_logs WHERE subject_type='production_webhook' AND subject_id=$1`, webhook.Id).Scan(&webhookAuditCount); err != nil || webhookAuditCount != 5 {
		t.Fatalf("webhook audit count=%d err=%v; want create/rotate/verify/failure/delete", webhookAuditCount, err)
	}
	failureWebhookID := uuid.New()
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_production_webhooks (id,application_id,organization_id,url,events,signing_secret_preview,signing_secret_hash,signing_secret_ciphertext,active,created_at,updated_at) VALUES ($1,$2,$3,'https://8.8.8.8/failure','[]'::jsonb,'whsec_••••1234','old-hash','old-cipher',true,now(),now())`, failureWebhookID, app, org); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `CREATE FUNCTION pg_temp.reject_webhook_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action LIKE 'webhook.%' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `CREATE TRIGGER reject_webhook_audit BEFORE INSERT ON developer_organization_audit_logs FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_webhook_audit()`); err != nil {
		t.Fatal(err)
	}
	if _, _, err := credentialStore.CreateWebhook(ctx, org, app, owner.String(), "https://8.8.8.8/failure-create", []string{"message.created"}); err == nil {
		t.Fatal("webhook creation succeeded when its audit write failed")
	}
	if _, _, err := credentialStore.RotateWebhookSecret(ctx, org, app, failureWebhookID, owner.String()); err == nil {
		t.Fatal("webhook rotation succeeded when its audit write failed")
	}
	if err := credentialStore.DeleteWebhook(ctx, org, app, failureWebhookID, owner.String()); err == nil {
		t.Fatal("webhook deletion succeeded when its audit write failed")
	}
	if err := credentialStore.RecordWebhookVerification(ctx, org, app, failureWebhookID, owner.String(), "verified"); err == nil {
		t.Fatal("webhook verification result succeeded when its audit write failed")
	}
	if _, err := db.ExecContext(ctx, `DROP TRIGGER reject_webhook_audit ON developer_organization_audit_logs`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `DROP FUNCTION pg_temp.reject_webhook_audit()`); err != nil {
		t.Fatal(err)
	}
	var failureWebhookStatus bool
	var failureWebhookHash string
	var verificationTime sql.NullTime
	if err := db.QueryRowContext(ctx, `SELECT active, signing_secret_hash, verified_at FROM developer_production_webhooks WHERE id=$1`, failureWebhookID).Scan(&failureWebhookStatus, &failureWebhookHash, &verificationTime); err != nil || !failureWebhookStatus || failureWebhookHash != "old-hash" || verificationTime.Valid {
		t.Fatalf("failed webhook audits changed resource active=%v hash=%q verified=%v err=%v", failureWebhookStatus, failureWebhookHash, verificationTime.Valid, err)
	}
	var webhookCount int
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM developer_production_webhooks`).Scan(&webhookCount); err != nil || webhookCount != 1 {
		t.Fatalf("failed webhook create changed row count: %d err=%v; want 1", webhookCount, err)
	}
}
