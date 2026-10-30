-- PostgreSQL checks foreign keys using the referencing table owner's privileges.
-- The append-only migration revoked UPDATE from that owner, which makes a valid
-- journal_lines insert fail when its FK takes a KEY SHARE lock on journal_entries.
-- Keep UPDATE limited to the immutable primary key; append-only triggers continue
-- to reject every UPDATE, and runtime roles receive no additional privilege here.
DO $$
DECLARE service_role text;
BEGIN
  EXECUTE format(
    'GRANT UPDATE (id) ON journal_entries, journal_lines TO %I',
    current_user
  );
  FOREACH service_role IN ARRAY ARRAY['svc_money', 'svc_ledger'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = service_role) THEN
      EXECUTE format('REVOKE UPDATE (id) ON journal_entries, journal_lines FROM %I', service_role);
      EXECUTE format('REVOKE DELETE, TRUNCATE ON ALL TABLES IN SCHEMA %I FROM %I', current_schema(), service_role);
    END IF;
  END LOOP;
END
$$;
