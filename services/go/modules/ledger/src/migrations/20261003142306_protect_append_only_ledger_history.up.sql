CREATE OR REPLACE FUNCTION refuse_change_to_append_only_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ledger history is append-only: % on % is not allowed; post a reversal instead', TG_OP, TG_TABLE_NAME USING ERRCODE = '42501';
END $$;
CREATE TRIGGER journal_entries_append_only BEFORE UPDATE OR DELETE ON "journal_entries" FOR EACH ROW EXECUTE FUNCTION refuse_change_to_append_only_history();
CREATE TRIGGER journal_entries_no_truncate BEFORE TRUNCATE ON "journal_entries" FOR EACH STATEMENT EXECUTE FUNCTION refuse_change_to_append_only_history();
CREATE TRIGGER journal_lines_append_only BEFORE UPDATE OR DELETE ON "journal_lines" FOR EACH ROW EXECUTE FUNCTION refuse_change_to_append_only_history();
CREATE TRIGGER journal_lines_no_truncate BEFORE TRUNCATE ON "journal_lines" FOR EACH STATEMENT EXECUTE FUNCTION refuse_change_to_append_only_history();
CREATE TRIGGER reconciliation_runs_append_only BEFORE UPDATE OR DELETE ON "reconciliation_runs" FOR EACH ROW EXECUTE FUNCTION refuse_change_to_append_only_history();
REVOKE UPDATE, DELETE, TRUNCATE ON "journal_entries", "journal_lines", "reconciliation_runs" FROM CURRENT_USER;
DO $$
DECLARE service_role text;
BEGIN
  FOREACH service_role IN ARRAY ARRAY['svc_ledger', 'svc_money'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = service_role) THEN
      EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON journal_entries, journal_lines, reconciliation_runs FROM %I', service_role);
    END IF;
  END LOOP;
END $$;
