package services_test

import (
	"context"
	"database/sql"
	"net/url"
	"os"
	"strings"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/ledger/src/databases/moneyTesting"
	ledgerservices "nantty/modules/ledger/src/modules/journal/services"
)

func TestLedgerRuntimeRoleIsLeastPrivilegeAndTransactionsRemainAtomic(t *testing.T) {
	if os.Getenv("NANTTY_RUN_LEDGER_PRIVILEGE_TEST") != "1" {
		t.Skip("requires explicit opt-in to the isolated local ledger privilege test")
	}
	runtimeURL := os.Getenv("MONEY_TEST_DATABASE_URL")
	adminURL := os.Getenv("MONEY_TEST_ADMIN_DATABASE_URL")
	assertIsolatedPrivilegeTestURL(t, runtimeURL, "svc_money")
	assertIsolatedPrivilegeTestURL(t, adminURL, "nantty")

	runtime := moneytesting.OpenTestDatabaseOrSkip(t)
	admin, err := sql.Open("pgx", adminURL)
	if err != nil {
		t.Fatal("open isolated database admin connection")
	}
	if err := admin.PingContext(context.Background()); err != nil {
		t.Fatal("connect to isolated database admin")
	}
	t.Cleanup(func() { _ = admin.Close() })

	var currentUser string
	if err := runtime.QueryRow("SELECT current_user").Scan(&currentUser); err != nil {
		t.Fatal(err)
	}
	if currentUser != "svc_money" {
		t.Fatalf("test runtime connected as %q, want svc_money", currentUser)
	}
	var hasMigratorRole, canCreateSchema bool
	if err := runtime.QueryRow(`
		SELECT pg_has_role(current_user, 'svc_migrator', 'MEMBER'), EXISTS (
			SELECT 1 FROM unnest(ARRAY['payments','wallet','ledger','escrow','subscriptions','creators']) AS schema_name
			WHERE has_schema_privilege(current_user, schema_name, 'CREATE')
		)
	`).Scan(&hasMigratorRole, &canCreateSchema); err != nil {
		t.Fatal(err)
	}
	var hasMoneySchemaOwnerRole bool
	if err := runtime.QueryRow(`SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('svc_payments', 'svc_wallet', 'svc_ledger', 'svc_escrow', 'svc_subscriptions', 'svc_creators') AND pg_has_role(current_user, rolname, 'MEMBER'))`).Scan(&hasMoneySchemaOwnerRole); err != nil {
		t.Fatal(err)
	}
	if hasMigratorRole || hasMoneySchemaOwnerRole || canCreateSchema {
		t.Fatalf("runtime inherited elevated privilege: migrator-member=%t money-schema-owner-member=%t schema-create=%t", hasMigratorRole, hasMoneySchemaOwnerRole, canCreateSchema)
	}

	moneySchemas := []string{"payments", "wallet", "ledger", "escrow", "subscriptions", "creators"}
	for _, schema := range moneySchemas {
		probe := schema + ".__runtime_privilege_probe"
		if _, err := admin.Exec(`DROP TABLE IF EXISTS ` + probe); err != nil {
			t.Fatalf("reset isolated %s privilege probe: %v", schema, err)
		}
		if _, err := admin.Exec(`CREATE TABLE ` + probe + ` (id integer)`); err != nil {
			t.Fatalf("create isolated %s privilege probe: %v", schema, err)
		}
		if _, err := admin.Exec(`ALTER TABLE ` + probe + ` OWNER TO svc_migrator`); err != nil {
			t.Fatalf("assign %s probe to schema owner: %v", schema, err)
		}
		t.Cleanup(func() { _, _ = admin.Exec(`DROP TABLE IF EXISTS ` + probe) })
	}
	t.Cleanup(func() { _, _ = admin.Exec(`DROP TABLE IF EXISTS ledger.__runtime_create_probe`) })
	t.Cleanup(func() { _, _ = admin.Exec(`REVOKE svc_migrator FROM svc_money`) })

	statements := []string{
		`CREATE TABLE ledger.__runtime_create_probe (id integer)`,
		`SET ROLE svc_migrator`,
		`CREATE ROLE __runtime_privilege_escalation`,
		`GRANT svc_migrator TO svc_money`,
	}
	for _, schema := range moneySchemas {
		probe := schema + ".__runtime_privilege_probe"
		statements = append(statements,
			`CREATE TABLE `+schema+`.__runtime_create_probe (id integer)`,
			`ALTER TABLE `+probe+` ADD COLUMN denied integer`,
			`DROP TABLE `+probe,
		)
	}
	for _, statement := range statements {
		if _, err := runtime.Exec(statement); err == nil {
			t.Fatalf("runtime unexpectedly succeeded: %s", statement)
		}
	}

	var canReadAccounts, canInsertAccounts, canUpdateAccounts, canDeleteJournal bool
	if err := runtime.QueryRow(`SELECT has_table_privilege(current_user, 'ledger.ledger_accounts', 'SELECT'), has_table_privilege(current_user, 'ledger.ledger_accounts', 'INSERT'), has_table_privilege(current_user, 'ledger.ledger_accounts', 'UPDATE'), has_table_privilege(current_user, 'ledger.journal_entries', 'DELETE')`).Scan(&canReadAccounts, &canInsertAccounts, &canUpdateAccounts, &canDeleteJournal); err != nil {
		t.Fatal(err)
	}
	if !canReadAccounts || !canInsertAccounts || !canUpdateAccounts || canDeleteJournal {
		t.Fatalf("runtime DML permissions are wrong: read=%t insert=%t update-account=%t delete-journal=%t", canReadAccounts, canInsertAccounts, canUpdateAccounts, canDeleteJournal)
	}
	var deletePrivilegesAreScoped bool
	if err := runtime.QueryRow(`
		SELECT
			NOT has_table_privilege(current_user, 'ledger.step_up_consumptions', 'DELETE')
			OR EXISTS (
				SELECT 1 FROM pg_tables
				WHERE schemaname = 'ledger'
				  AND tablename <> 'step_up_consumptions'
				  AND has_table_privilege(current_user, quote_ident(schemaname) || '.' || quote_ident(tablename), 'DELETE')
			)
			OR EXISTS (
				SELECT 1 FROM pg_tables
				WHERE schemaname = 'ledger'
				  AND has_table_privilege(current_user, quote_ident(schemaname) || '.' || quote_ident(tablename), 'TRUNCATE')
			)
	`).Scan(&deletePrivilegesAreScoped); err != nil {
		t.Fatal(err)
	}
	if deletePrivilegesAreScoped {
		t.Fatal("runtime DELETE must be limited to step-up expiry rows and TRUNCATE must remain denied")
	}
	if _, err := runtime.Exec(`DELETE FROM ledger.step_up_consumptions WHERE expires_at < now()`); err != nil {
		t.Fatalf("runtime cannot perform the required step-up expiry cleanup: %v", err)
	}
	var ownerCanKeyLock, ownerCanUpdateJournal, runtimeCanUpdateJournalID bool
	if err := runtime.QueryRow(`SELECT has_column_privilege('svc_migrator', 'ledger.journal_entries', 'id', 'UPDATE'), has_table_privilege('svc_migrator', 'ledger.journal_entries', 'UPDATE'), has_column_privilege(current_user, 'ledger.journal_entries', 'id', 'UPDATE')`).Scan(&ownerCanKeyLock, &ownerCanUpdateJournal, &runtimeCanUpdateJournalID); err != nil {
		t.Fatal(err)
	}
	if !ownerCanKeyLock || ownerCanUpdateJournal || runtimeCanUpdateJournalID {
		t.Fatalf("FK/runtime privileges are not narrow: owner-key-update=%t owner-table-update=%t runtime-key-update=%t", ownerCanKeyLock, ownerCanUpdateJournal, runtimeCanUpdateJournalID)
	}

	ledger := ledgerservices.NewLedgerInSchema("ledger")
	reference := "runtime-atomicity-" + uuid.NewString()
	userID := uuid.NewString()
	request := issueCoinsEntry(reference, userID, 321)
	transaction, err := runtime.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	_, err = ledger.PostBalancedJournalEntry(context.Background(), transaction, request)
	if err != nil {
		_ = transaction.Rollback()
		t.Fatalf("runtime could not post inside a transaction: %v", err)
	}
	if err := transaction.Rollback(); err != nil {
		t.Fatal(err)
	}
	assertLedgerReferenceCount(t, runtime, reference, 0)

	posted, err := runPost(runtime, ledger, request)
	if err != nil {
		t.Fatalf("runtime could not commit balanced ledger entry: %v", err)
	}
	if len(posted.Id) == 0 || len(posted.BalancesAfter) != 2 {
		t.Fatalf("expected two account balances in posting result: %+v", posted)
	}
	assertLedgerReferenceCount(t, runtime, reference, 1)
	if _, err := runtime.Exec(`UPDATE ledger.journal_entries SET id = id WHERE reference = $1`, reference); err == nil {
		t.Fatal("runtime updated append-only journal history")
	}
	var debit, credit int64
	if err := runtime.QueryRow(`SELECT COALESCE(sum(l.amount_minor) FILTER (WHERE l.direction = 'debit'), 0), COALESCE(sum(l.amount_minor) FILTER (WHERE l.direction = 'credit'), 0) FROM ledger.journal_entries e JOIN ledger.journal_lines l ON l.entry_id = e.id WHERE e.reference = $1`, reference).Scan(&debit, &credit); err != nil {
		t.Fatal(err)
	}
	if debit != 321 || credit != 321 {
		t.Fatalf("posted entry is unbalanced: debit=%d credit=%d", debit, credit)
	}
	var userBalance int64
	if err := runtime.QueryRow(`SELECT balance_minor FROM ledger.ledger_accounts WHERE owner_id = $1`, userID).Scan(&userBalance); err != nil {
		t.Fatal(err)
	}
	if userBalance != 321 {
		t.Fatalf("user balance = %d, want 321", userBalance)
	}

	invalid := issueCoinsEntry("runtime-unbalanced-"+uuid.NewString(), uuid.NewString(), 50)
	invalid.Lines[1].AmountMinor++
	if _, err := runPost(runtime, ledger, invalid); err == nil {
		t.Fatal("unbalanced synthetic journal entry unexpectedly posted")
	}
	assertLedgerReferenceCount(t, runtime, invalid.Reference, 0)
}

func assertIsolatedPrivilegeTestURL(t *testing.T, rawURL, expectedUser string) {
	t.Helper()
	parsed, err := url.Parse(rawURL)
	if err != nil || parsed.User == nil || parsed.User.Username() != expectedUser || parsed.Hostname() != "127.0.0.1" || strings.TrimPrefix(parsed.Path, "/") != "nantty_test" {
		t.Fatalf("privilege test requires a local nantty_test URL authenticated as %s", expectedUser)
	}
}

func assertLedgerReferenceCount(t *testing.T, database *sql.DB, reference string, want int) {
	t.Helper()
	var count int
	if err := database.QueryRow(`SELECT count(*) FROM ledger.journal_entries WHERE reference = $1`, reference).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != want {
		t.Fatalf("journal entries for %s = %d, want %d", reference, count, want)
	}
}
