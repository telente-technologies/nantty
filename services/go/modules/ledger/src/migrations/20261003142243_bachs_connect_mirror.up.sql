-- drop index "journalentry_external_reference" from table: "journal_entries"
DROP INDEX "journalentry_external_reference";
-- create index "journalentry_external_reference" to table: "journal_entries"
CREATE INDEX "journalentry_external_reference" ON "journal_entries" ("external_reference") WHERE ((external_reference)::text <> ''::text);
-- create index "journalentry_posted_at" to table: "journal_entries"
CREATE INDEX "journalentry_posted_at" ON "journal_entries" ("posted_at");
-- drop index "journalline_account_id_created_at" from table: "journal_lines"
DROP INDEX "journalline_account_id_created_at";
-- create index "journalline_account_id_id" to table: "journal_lines"
CREATE INDEX "journalline_account_id_id" ON "journal_lines" ("account_id", "id" DESC);
-- create index "ledgeraccount_code_pattern" to table: "ledger_accounts"
CREATE INDEX "ledgeraccount_code_pattern" ON "ledger_accounts" ("code" varchar_pattern_ops);
