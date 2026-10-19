DO $$ BEGIN EXECUTE format($sql$CREATE OR REPLACE FUNCTION %1$I.account_age_bracket(account_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = %1$I, pg_temp AS 'SELECT CASE WHEN birthday IS NULL THEN ''unknown'' WHEN birthday <= ((now() AT TIME ZONE ''UTC'')::date - interval ''18 years'') THEN ''adult'' ELSE ''minor'' END FROM accounts WHERE id = account_id'$sql$, current_schema()); END $$;
REVOKE ALL ON FUNCTION account_age_bracket(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION account_age_bracket(uuid) TO zudomart_readers;
