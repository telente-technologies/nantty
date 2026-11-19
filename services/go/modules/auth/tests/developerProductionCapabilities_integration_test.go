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
	resource := production.Store{Container: &container.Container{Database: db}}
	for _, tc := range []struct {
		name       string
		actor      uuid.UUID
		capability string
		allow      bool
	}{
		{"owner", owner, "credentials.manage", true},
		{"granted developer", developer, "credentials.manage", true},
		{"ungranted developer", developer, "webhooks.manage", false},
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
}
