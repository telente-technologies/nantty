-- New ordinary Live sessions must not accept coin support unless the host opts in.
-- Existing live_sessions rows are intentionally unchanged for legacy compatibility.
ALTER TABLE "live_sessions" ALTER COLUMN "gifts_enabled" SET DEFAULT false;
