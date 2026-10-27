DO $$ BEGIN EXECUTE format('GRANT USAGE ON SCHEMA %I TO nantty_readers', current_schema()); END $$;
GRANT SELECT ("key", "value", "version", "updated_at") ON "platform_settings" TO nantty_readers;
REVOKE UPDATE, DELETE, TRUNCATE ON "audit_events" FROM CURRENT_USER;
REVOKE UPDATE, DELETE, TRUNCATE ON "platform_setting_revisions" FROM CURRENT_USER;
