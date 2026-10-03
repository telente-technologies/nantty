CREATE OR REPLACE FUNCTION refuse_change_to_append_only_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'escrow history is append-only: % on % is not allowed', TG_OP, TG_TABLE_NAME USING ERRCODE = '42501';
END $$;
CREATE TRIGGER escrow_events_append_only BEFORE UPDATE OR DELETE ON "escrow_events" FOR EACH ROW EXECUTE FUNCTION refuse_change_to_append_only_history();
CREATE TRIGGER escrow_events_no_truncate BEFORE TRUNCATE ON "escrow_events" FOR EACH STATEMENT EXECUTE FUNCTION refuse_change_to_append_only_history();
REVOKE UPDATE, DELETE, TRUNCATE ON "escrow_events" FROM CURRENT_USER;
DO $$
DECLARE service_role text;
BEGIN
  FOREACH service_role IN ARRAY ARRAY['svc_escrow', 'svc_money'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = service_role) THEN
      EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON escrow_events FROM %I', service_role);
    END IF;
  END LOOP;
END $$;
