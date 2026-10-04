package services

import (
	"context"
	"database/sql"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"zudomart/modules/ledger/src/databases"
	moneytesting "zudomart/modules/ledger/src/databases/moneyTesting"
	"zudomart/modules/ledger/src/migrations"
	"zudomart/modules/ledger/src/modules/journal/models"
	"zudomart/platform/postgres"
)

func openAsServiceRole(t *testing.T, role, password string) (*sql.DB, string) {
	t.Helper()
	superuser := moneytesting.OpenTestDatabaseOrSkip(t)
	var roleExists bool
	if err := superuser.QueryRow("SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1)", role).Scan(&roleExists); err != nil || !roleExists {
		t.Skipf("role %s does not exist in the compose Postgres", role)
	}
	schema := moneytesting.CreateFreshSchemaWithMigrations(t, superuser, "ledgerrole", migrations.Files)
	quoted := pgx.Identifier{schema}.Sanitize()
	grantStatements := []string{"GRANT USAGE ON SCHEMA " + quoted + " TO " + role}
	var tables []string
	rows, err := superuser.Query("SELECT tablename FROM pg_tables WHERE schemaname = $1", schema)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var table string
		if err := rows.Scan(&table); err != nil {
			t.Fatal(err)
		}
		tables = append(tables, table)
	}
	_ = rows.Close()
	for _, table := range tables {
		privileges := "SELECT, INSERT, UPDATE, DELETE"
		if table == "journal_entries" || table == "journal_lines" || table == "reconciliation_runs" {
			privileges = "SELECT, INSERT"
		}
		grantStatements = append(grantStatements, "GRANT "+privileges+" ON "+quoted+"."+pgx.Identifier{table}.Sanitize()+" TO "+role)
	}
	for _, statement := range grantStatements {
		if _, err := superuser.Exec(statement); err != nil {
			t.Fatalf("%s: %v", statement, err)
		}
	}
	parsed, err := url.Parse(moneytesting.TestDatabaseUrl())
	if err != nil {
		t.Fatal(err)
	}
	parsed.User = url.UserPassword(role, password)
	database, err := postgres.OpenDatabaseAndVerifyConnection(context.Background(), parsed.String(), postgres.PoolSettings{MaximumOpenConnections: 4, MaximumIdleConnections: 2, ConnectionMaximumLife: time.Minute})
	if err != nil {
		t.Skipf("cannot connect as %s: %v", role, err)
	}
	t.Cleanup(func() { _ = database.Close() })
	var current string
	if err := database.QueryRow("SELECT current_user").Scan(&current); err != nil || current != role {
		t.Fatalf("expected to run as %s, got %q (%v)", role, current, err)
	}
	return database, schema
}

func TestPostingAsRealServiceRolesWorksAndHistoryStaysAppendOnly(t *testing.T) {
	for _, role := range []string{"svc_money", "svc_ledger"} {
		t.Run(role, func(t *testing.T) {
			database, schema := openAsServiceRole(t, role, role+"_local_only")
			ledger := NewLedgerInSchema(schema)
			posted, err := runPost(database, ledger, issueCoinsEntry("role-issue-1", "dana", 50))
			if err != nil {
				t.Fatalf("balanced entry with lines must post as %s: %v", role, err)
			}
			if len(posted.Id) == 0 {
				t.Fatal("no entry id returned")
			}
			quoted := pgx.Identifier{schema}.Sanitize()
			for _, table := range []string{"journal_entries", "journal_lines"} {
				for _, statement := range []string{
					"UPDATE " + quoted + "." + table + " SET id = id",
					"DELETE FROM " + quoted + "." + table,
				} {
					if _, err := database.Exec(statement); err == nil {
						t.Fatalf("%s must be refused for %s", statement, role)
					} else if !strings.Contains(err.Error(), "permission denied") && !strings.Contains(err.Error(), "append-only") {
						t.Fatalf("%s refused for an unexpected reason: %v", statement, err)
					}
				}
			}
			var lines int
			if err := database.QueryRow("SELECT count(*) FROM " + quoted + ".journal_lines").Scan(&lines); err != nil || lines != 2 {
				t.Fatalf("expected 2 untouched lines, got %d (%v)", lines, err)
			}
		})
	}
}

func runPost(database *sql.DB, ledger *Ledger, request models.JournalEntryRequest) (models.PostedJournalEntry, error) {
	var posted models.PostedJournalEntry
	err := databases.RunInMoneyTransaction(context.Background(), database, func(ctx context.Context, transaction *sql.Tx) error {
		var postError error
		posted, postError = ledger.PostBalancedJournalEntry(ctx, transaction, request)
		return postError
	})
	return posted, err
}
