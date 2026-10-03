DROP TRIGGER IF EXISTS escrow_events_no_truncate ON "escrow_events";
DROP TRIGGER IF EXISTS escrow_events_append_only ON "escrow_events";
DROP FUNCTION IF EXISTS refuse_change_to_append_only_history();
GRANT UPDATE, DELETE, TRUNCATE ON "escrow_events" TO CURRENT_USER;
