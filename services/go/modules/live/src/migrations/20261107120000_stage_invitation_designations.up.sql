ALTER TABLE "guest_slots"
  ADD COLUMN "stage_role" character varying NOT NULL DEFAULT 'speaker',
  ADD COLUMN "stage_title" character varying(32) NULL;
