-- modify "escrows" table
ALTER TABLE "escrows" ADD COLUMN "paused_release_remaining_seconds" bigint NULL;
