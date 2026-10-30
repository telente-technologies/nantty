-- Roll back the owner-only column privilege added for PostgreSQL FK checks.
DO $$
BEGIN
  EXECUTE format(
    'REVOKE UPDATE (id) ON journal_entries, journal_lines FROM %I',
    current_user
  );
END
$$;
