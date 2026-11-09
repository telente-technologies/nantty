CREATE TABLE "activity_heartbeats" (
    "account_id" UUID NOT NULL,
    "last_activity_at" TIMESTAMPTZ NOT NULL,
    "time_zone" VARCHAR(64) NOT NULL,
    "last_reengagement_attempt_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_heartbeats_pkey" PRIMARY KEY ("account_id")
);

CREATE INDEX "activity_heartbeats_due_idx"
ON "activity_heartbeats" ("last_activity_at", "last_reengagement_attempt_at");

CREATE TABLE "reengagement_deliveries" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "campaign_id" VARCHAR(80) NOT NULL,
    "content_key" VARCHAR(120) NOT NULL,
    "dedupe_key" VARCHAR(240) NOT NULL,
    "activity_at" TIMESTAMPTZ NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "outcome_reason" VARCHAR(200),
    "queue_lease_until" TIMESTAMPTZ,
    "queue_lock_token" UUID,
    "sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reengagement_deliveries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reengagement_deliveries_activity_fkey"
      FOREIGN KEY ("account_id") REFERENCES "activity_heartbeats"("account_id") ON DELETE CASCADE,
    CONSTRAINT "reengagement_deliveries_status_check"
      CHECK ("status" IN ('pending', 'dispatching', 'sent', 'skipped', 'failed'))
);

CREATE UNIQUE INDEX "reengagement_deliveries_dedupe_key_key"
ON "reengagement_deliveries" ("dedupe_key");
CREATE UNIQUE INDEX "reengagement_deliveries_account_campaign_content_key"
ON "reengagement_deliveries" ("account_id", "campaign_id", "content_key");
CREATE INDEX "reengagement_deliveries_queue_idx"
ON "reengagement_deliveries" ("status", "queue_lease_until", "created_at");
