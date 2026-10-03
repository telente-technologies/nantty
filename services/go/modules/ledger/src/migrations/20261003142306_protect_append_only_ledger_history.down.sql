DROP TRIGGER IF EXISTS reconciliation_runs_append_only ON "reconciliation_runs";
DROP TRIGGER IF EXISTS journal_lines_no_truncate ON "journal_lines";
DROP TRIGGER IF EXISTS journal_lines_append_only ON "journal_lines";
DROP TRIGGER IF EXISTS journal_entries_no_truncate ON "journal_entries";
DROP TRIGGER IF EXISTS journal_entries_append_only ON "journal_entries";
DROP FUNCTION IF EXISTS refuse_change_to_append_only_history();
GRANT UPDATE, DELETE, TRUNCATE ON "journal_entries", "journal_lines", "reconciliation_runs" TO CURRENT_USER;
