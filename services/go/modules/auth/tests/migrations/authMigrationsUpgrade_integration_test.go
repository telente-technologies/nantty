package migrations_test

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/golang-migrate/migrate/v4"
	migratepgx "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5"

	authmigrations "nantty/modules/auth/src/migrations"
	"nantty/platform/postgres"
)

const identityBaselineVersion uint = 20261116160000

func TestIdentityMigrationsUpgradeRollbackAndReplay(t *testing.T) {
	databaseURL := os.Getenv("AUTH_TEST_DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgres://nantty:nantty@localhost:15432/nantty_test?sslmode=disable"
	}

	ctx := context.Background()
	adminDatabase, err := postgres.OpenDatabaseAndVerifyConnection(ctx, databaseURL, postgres.DefaultPoolSettings())
	if err != nil {
		t.Skipf("postgres not reachable: %v", err)
	}
	schema := fmt.Sprintf("auth_migration_upgrade_%d", time.Now().UnixNano())
	if err := postgres.CreateSchemaIfMissingForTestsAndLocalTooling(ctx, adminDatabase, schema); err != nil {
		_ = adminDatabase.Close()
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = adminDatabase.ExecContext(ctx, "DROP SCHEMA "+pgx.Identifier{schema}.Sanitize()+" CASCADE")
		_ = adminDatabase.Close()
	})

	scopedURL, err := postgres.ScopeDatabaseUrlToSchema(databaseURL, schema)
	if err != nil {
		t.Fatal(err)
	}
	verificationDatabase, err := postgres.OpenDatabaseAndVerifyConnection(ctx, scopedURL, postgres.DefaultPoolSettings())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = verificationDatabase.Close() })

	source, err := iofs.New(authmigrations.Files, ".")
	if err != nil {
		t.Fatal(err)
	}
	migrationDatabase, err := sql.Open("pgx", scopedURL)
	if err != nil {
		t.Fatal(err)
	}
	driver, err := migratepgx.WithInstance(migrationDatabase, &migratepgx.Config{})
	if err != nil {
		_ = migrationDatabase.Close()
		t.Fatal(err)
	}
	manager, err := migrate.NewWithInstance("iofs", source, "pgx5", driver)
	if err != nil {
		_ = driver.Close()
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = manager.Close() })

	if err := manager.Migrate(identityBaselineVersion); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		t.Fatalf("apply pre-change Identity baseline: %v", err)
	}
	if _, err := verificationDatabase.ExecContext(ctx,
		"INSERT INTO accounts (id, created_at, username, roles, updated_at) VALUES ($1, $2, $3, '[]'::jsonb, $2)",
		"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", time.Now().UTC(), "migration_upgrade_retention"); err != nil {
		t.Fatalf("seed baseline account: %v", err)
	}

	if err := manager.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		t.Fatalf("upgrade Identity migrations: %v", err)
	}
	assertBaselineAccountSurvives(t, ctx, verificationDatabase)
	assertStoreScopeColumn(t, ctx, verificationDatabase, schema, true)
	assertWebhookLeaseColumn(t, ctx, verificationDatabase, schema, true)

	if err := manager.Migrate(identityBaselineVersion); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		t.Fatalf("roll back Identity migration set: %v", err)
	}
	assertBaselineAccountSurvives(t, ctx, verificationDatabase)
	var authorizationTableExists bool
	if err := verificationDatabase.QueryRowContext(ctx,
		"SELECT to_regclass($1) IS NOT NULL", schema+".developer_business_authorizations").Scan(&authorizationTableExists); err != nil {
		t.Fatal(err)
	}
	if authorizationTableExists {
		t.Fatal("developer business authorization table remains after rollback")
	}
	assertStoreScopeColumn(t, ctx, verificationDatabase, schema, false)
	assertWebhookLeaseColumn(t, ctx, verificationDatabase, schema, false)

	if err := manager.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		t.Fatalf("replay Identity migrations after rollback: %v", err)
	}
	assertBaselineAccountSurvives(t, ctx, verificationDatabase)
	assertStoreScopeColumn(t, ctx, verificationDatabase, schema, true)
	assertWebhookLeaseColumn(t, ctx, verificationDatabase, schema, true)
}

func assertBaselineAccountSurvives(t *testing.T, ctx context.Context, database *sql.DB) {
	t.Helper()
	var count int
	if err := database.QueryRowContext(ctx, "SELECT count(*) FROM accounts WHERE username = $1", "migration_upgrade_retention").Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("baseline account row count = %d, want 1", count)
	}
}

func assertStoreScopeColumn(t *testing.T, ctx context.Context, database *sql.DB, schema string, expected bool) {
	t.Helper()
	var count int
	if err := database.QueryRowContext(ctx,
		"SELECT count(*) FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3",
		schema, "developer_business_messages", "store_id").Scan(&count); err != nil {
		t.Fatal(err)
	}
	if (count == 1) != expected {
		t.Fatalf("store_id column exists = %t, want %t", count == 1, expected)
	}
}

func assertWebhookLeaseColumn(t *testing.T, ctx context.Context, database *sql.DB, schema string, expected bool) {
	t.Helper()
	var count int
	if err := database.QueryRowContext(ctx,
		"SELECT count(*) FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3",
		schema, "developer_production_webhook_deliveries", "lease_expires_at").Scan(&count); err != nil {
		t.Fatal(err)
	}
	if (count == 1) != expected {
		t.Fatalf("lease_expires_at column exists = %t, want %t", count == 1, expected)
	}
}
