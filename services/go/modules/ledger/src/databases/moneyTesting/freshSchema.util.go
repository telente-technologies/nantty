package moneytesting

import (
	"context"
	"database/sql"
	"fmt"
	"io/fs"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"zudomart/modules/ledger/src/databases"
	"zudomart/platform/postgres"
)

var schemaCounter atomic.Int64

func TestDatabaseUrl() string {
	if configured := os.Getenv("MONEY_TEST_DATABASE_URL"); configured != "" {
		return configured
	}
	return "postgres://zudomart:zudomart@localhost:15432/zudomart_test?sslmode=disable"
}

func OpenTestDatabaseOrSkip(t *testing.T) *sql.DB {
	t.Helper()
	database, err := postgres.OpenDatabaseAndVerifyConnection(context.Background(), TestDatabaseUrl(), postgres.PoolSettings{MaximumOpenConnections: 60, MaximumIdleConnections: 10, ConnectionMaximumLife: time.Minute})
	if err != nil {
		t.Skipf("postgres not reachable (run pnpm backend:up): %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })
	return database
}

func CreateFreshSchemaWithMigrations(t *testing.T, database *sql.DB, prefix string, files fs.FS) string {
	t.Helper()
	schema := fmt.Sprintf("money_test_%s_%d_%d", strings.ToLower(prefix), time.Now().UnixNano(), schemaCounter.Add(1))
	ctx := context.Background()
	if err := postgres.CreateSchemaIfMissingForTestsAndLocalTooling(ctx, database, schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = database.Exec("DROP SCHEMA " + pgx.Identifier{schema}.Sanitize() + " CASCADE")
	})
	if err := databases.ApplyModuleMigrationsAsSchemaOwner(databases.ModuleMigrationTarget{DatabaseUrl: TestDatabaseUrl(), Schema: schema, Files: files}); err != nil {
		t.Fatalf("apply migrations to %s: %v", schema, err)
	}
	return schema
}
