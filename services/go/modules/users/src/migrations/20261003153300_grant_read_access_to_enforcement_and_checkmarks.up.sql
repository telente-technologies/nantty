GRANT SELECT ("profile_id", "account_id", "color", "status") ON "profile_checkmarks" TO nantty_readers;
GRANT SELECT ("account_id", "status", "deletion_due_at") ON "account_suspensions" TO nantty_readers;
GRANT SELECT ("account_id", "features", "ends_at", "lifted_at") ON "account_restrictions" TO nantty_readers;
GRANT SELECT ("account_id", "lifted_at", "ends_at") ON "account_bans" TO nantty_readers;
GRANT SELECT ("id", "document_key", "version_number", "status", "effective_at", "is_material_change", "published_at") ON "legal_versions" TO nantty_readers;
GRANT SELECT ("profile_type", "creator_status") ON "profiles" TO nantty_readers;
GRANT SELECT ("account_id", "who_can_message_me", "who_can_mention_me") ON "privacy_settings" TO nantty_readers;
