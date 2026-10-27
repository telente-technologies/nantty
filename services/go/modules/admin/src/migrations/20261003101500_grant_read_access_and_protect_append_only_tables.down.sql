GRANT UPDATE, DELETE, TRUNCATE ON "audit_events" TO CURRENT_USER;
GRANT UPDATE, DELETE, TRUNCATE ON "platform_setting_revisions" TO CURRENT_USER;
REVOKE SELECT ("key", "value", "version", "updated_at") ON "platform_settings" FROM nantty_readers;
