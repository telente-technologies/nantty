-- reverse: create index "ledgeraccount_code_pattern" to table: "ledger_accounts"
DROP INDEX "ledgeraccount_code_pattern";
-- reverse: create index "journalline_account_id_id" to table: "journal_lines"
DROP INDEX "journalline_account_id_id";
-- reverse: drop index "journalline_account_id_created_at" from table: "journal_lines"
CREATE INDEX "journalline_account_id_created_at" ON "journal_lines" ("account_id", "created_at");
-- reverse: create index "journalentry_posted_at" to table: "journal_entries"
DROP INDEX "journalentry_posted_at";
-- reverse: create index "journalentry_external_reference" to table: "journal_entries"
DROP INDEX "journalentry_external_reference";
-- reverse: drop index "journalentry_external_reference" from table: "journal_entries"
CREATE INDEX "journalentry_external_reference" ON "journal_entries" ("external_reference");
