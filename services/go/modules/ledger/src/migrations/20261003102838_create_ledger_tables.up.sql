-- create "journal_entries" table
CREATE TABLE "journal_entries" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "reference" character varying NOT NULL, "kind" character varying NOT NULL, "description" character varying NOT NULL DEFAULT '', "external_reference" character varying NOT NULL DEFAULT '', "reverses_entry_id" uuid NULL, "metadata" jsonb NOT NULL, "posted_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "journalentry_external_reference" to table: "journal_entries"
CREATE INDEX "journalentry_external_reference" ON "journal_entries" ("external_reference");
-- create index "journalentry_kind_posted_at" to table: "journal_entries"
CREATE INDEX "journalentry_kind_posted_at" ON "journal_entries" ("kind", "posted_at");
-- create index "journalentry_reference" to table: "journal_entries"
CREATE UNIQUE INDEX "journalentry_reference" ON "journal_entries" ("reference");
-- create index "journalentry_reverses_entry_id" to table: "journal_entries"
CREATE UNIQUE INDEX "journalentry_reverses_entry_id" ON "journal_entries" ("reverses_entry_id");
-- create "outbox_events" table
CREATE TABLE "outbox_events" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "event_type" character varying NOT NULL, "subject" character varying NOT NULL, "payload" jsonb NOT NULL, "published_at" timestamptz NULL, "attempt_count" bigint NOT NULL DEFAULT 0, "next_attempt_at" timestamptz NULL, "last_error" character varying NOT NULL DEFAULT '', "dead_lettered_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "outboxevent_published_at_dead_lettered_at_created_at" to table: "outbox_events"
CREATE INDEX "outboxevent_published_at_dead_lettered_at_created_at" ON "outbox_events" ("published_at", "dead_lettered_at", "created_at");
-- create "ledger_accounts" table
CREATE TABLE "ledger_accounts" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "code" character varying NOT NULL, "currency" character varying NOT NULL, "kind" character varying NOT NULL, "normal_side" character varying NOT NULL, "owner_type" character varying NOT NULL DEFAULT '', "owner_id" character varying NOT NULL DEFAULT '', "allow_negative_balance" boolean NOT NULL DEFAULT false, "balance_minor" bigint NOT NULL DEFAULT 0, "debits_total_minor" bigint NOT NULL DEFAULT 0, "credits_total_minor" bigint NOT NULL DEFAULT 0, "version" bigint NOT NULL DEFAULT 0, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "ledger_accounts_balance_not_negative_unless_allowed" CHECK (allow_negative_balance OR (balance_minor >= 0)), CONSTRAINT "ledger_accounts_totals_not_negative" CHECK ((debits_total_minor >= 0) AND (credits_total_minor >= 0)));
-- create index "ledgeraccount_code_currency" to table: "ledger_accounts"
CREATE UNIQUE INDEX "ledgeraccount_code_currency" ON "ledger_accounts" ("code", "currency");
-- create index "ledgeraccount_owner_type_owner_id" to table: "ledger_accounts"
CREATE INDEX "ledgeraccount_owner_type_owner_id" ON "ledger_accounts" ("owner_type", "owner_id");
-- create "journal_lines" table
CREATE TABLE "journal_lines" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "direction" character varying NOT NULL, "amount_minor" bigint NOT NULL, "currency" character varying NOT NULL, "line_number" bigint NOT NULL, "balance_after_minor" bigint NOT NULL, "entry_id" uuid NOT NULL, "account_id" uuid NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "journal_lines_journal_entries_lines" FOREIGN KEY ("entry_id") REFERENCES "journal_entries" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION, CONSTRAINT "journal_lines_ledger_accounts_lines" FOREIGN KEY ("account_id") REFERENCES "ledger_accounts" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION, CONSTRAINT "journal_lines_amount_positive" CHECK (amount_minor > 0));
-- create index "journalline_account_id_created_at" to table: "journal_lines"
CREATE INDEX "journalline_account_id_created_at" ON "journal_lines" ("account_id", "created_at");
-- create index "journalline_entry_id_line_number" to table: "journal_lines"
CREATE UNIQUE INDEX "journalline_entry_id_line_number" ON "journal_lines" ("entry_id", "line_number");
-- create "reconciliation_runs" table
CREATE TABLE "reconciliation_runs" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "provider" character varying NOT NULL, "window_starts_at" timestamptz NOT NULL, "window_ends_at" timestamptz NOT NULL, "matched_count" bigint NOT NULL, "break_count" bigint NOT NULL, PRIMARY KEY ("id"));
-- create index "reconciliationrun_provider_window_starts_at" to table: "reconciliation_runs"
CREATE INDEX "reconciliationrun_provider_window_starts_at" ON "reconciliation_runs" ("provider", "window_starts_at");
-- create "reconciliation_breaks" table
CREATE TABLE "reconciliation_breaks" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "kind" character varying NOT NULL, "provider_reference" character varying NOT NULL, "currency" character varying NOT NULL DEFAULT '', "expected_amount_minor" bigint NOT NULL DEFAULT 0, "provider_amount_minor" bigint NOT NULL DEFAULT 0, "journal_entry_id" uuid NULL, "resolved_at" timestamptz NULL, "resolution_note" character varying NOT NULL DEFAULT '', "run_id" uuid NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "reconciliation_breaks_reconciliation_runs_breaks" FOREIGN KEY ("run_id") REFERENCES "reconciliation_runs" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION);
-- create index "reconciliationbreak_provider_reference" to table: "reconciliation_breaks"
CREATE INDEX "reconciliationbreak_provider_reference" ON "reconciliation_breaks" ("provider_reference");
-- create index "reconciliationbreak_resolved_at" to table: "reconciliation_breaks"
CREATE INDEX "reconciliationbreak_resolved_at" ON "reconciliation_breaks" ("resolved_at");
