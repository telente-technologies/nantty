CREATE TABLE IF NOT EXISTS "child_safety_quarantine" (
  "id" uuid PRIMARY KEY,
  "media_id" varchar(128) NOT NULL UNIQUE,
  "owner_id" varchar(128) NOT NULL,
  "sha256_hex" varchar(64) NOT NULL,
  "perceptual_hash" text NULL,
  "provider" varchar(64) NOT NULL,
  "match_list_id" varchar(128) NULL,
  "confidence" integer NOT NULL DEFAULT 0,
  "status" varchar(64) NOT NULL,
  "report_reference" varchar(128) NULL,
  "detected_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "child_safety_quarantine_detected_idx" ON "child_safety_quarantine" ("detected_at" DESC);
