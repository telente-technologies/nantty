DO $$
DECLARE service_role text;
BEGIN
  FOREACH service_role IN ARRAY ARRAY['svc_ledger', 'svc_money'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = service_role) THEN
      EXECUTE format('REVOKE UPDATE (id) ON journal_entries, journal_lines FROM %I', service_role);
    END IF;
  END LOOP;
END $$;
