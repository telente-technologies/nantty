-- reverse: create index "reconciliationbreak_resolved_at" to table: "reconciliation_breaks"
DROP INDEX "reconciliationbreak_resolved_at";
-- reverse: create index "reconciliationbreak_provider_reference" to table: "reconciliation_breaks"
DROP INDEX "reconciliationbreak_provider_reference";
-- reverse: create "reconciliation_breaks" table
DROP TABLE "reconciliation_breaks";
-- reverse: create index "reconciliationrun_provider_window_starts_at" to table: "reconciliation_runs"
DROP INDEX "reconciliationrun_provider_window_starts_at";
-- reverse: create "reconciliation_runs" table
DROP TABLE "reconciliation_runs";
-- reverse: create index "journalline_entry_id_line_number" to table: "journal_lines"
DROP INDEX "journalline_entry_id_line_number";
-- reverse: create index "journalline_account_id_created_at" to table: "journal_lines"
DROP INDEX "journalline_account_id_created_at";
-- reverse: create "journal_lines" table
DROP TABLE "journal_lines";
-- reverse: create index "ledgeraccount_owner_type_owner_id" to table: "ledger_accounts"
DROP INDEX "ledgeraccount_owner_type_owner_id";
-- reverse: create index "ledgeraccount_code_currency" to table: "ledger_accounts"
DROP INDEX "ledgeraccount_code_currency";
-- reverse: create "ledger_accounts" table
DROP TABLE "ledger_accounts";
-- reverse: create index "outboxevent_published_at_dead_lettered_at_created_at" to table: "outbox_events"
DROP INDEX "outboxevent_published_at_dead_lettered_at_created_at";
-- reverse: create "outbox_events" table
DROP TABLE "outbox_events";
-- reverse: create index "journalentry_reverses_entry_id" to table: "journal_entries"
DROP INDEX "journalentry_reverses_entry_id";
-- reverse: create index "journalentry_reference" to table: "journal_entries"
DROP INDEX "journalentry_reference";
-- reverse: create index "journalentry_kind_posted_at" to table: "journal_entries"
DROP INDEX "journalentry_kind_posted_at";
-- reverse: create index "journalentry_external_reference" to table: "journal_entries"
DROP INDEX "journalentry_external_reference";
-- reverse: create "journal_entries" table
DROP TABLE "journal_entries";
