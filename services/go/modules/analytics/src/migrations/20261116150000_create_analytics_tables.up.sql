CREATE TABLE IF NOT EXISTS "analytics_events" (
    "id" uuid NOT NULL,
    "event_key" character varying(160) NOT NULL,
    "domain" character varying(48) NOT NULL,
    "event_name" character varying(80) NOT NULL,
    "subject_id" character varying(128) NOT NULL DEFAULT '',
    "actor_id" character varying(128) NOT NULL DEFAULT '',
    "store_id" character varying(128) NOT NULL DEFAULT '',
    "amount_minor" bigint NOT NULL DEFAULT 0,
    "currency" character varying(8) NOT NULL DEFAULT '',
    "anonymized" boolean NOT NULL DEFAULT false,
    "properties" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "occurred_at" timestamptz NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "analytics_events_event_key_uidx" ON "analytics_events" ("event_key");
CREATE INDEX IF NOT EXISTS "analytics_events_domain_occurred_idx" ON "analytics_events" ("domain", "occurred_at" DESC);
CREATE INDEX IF NOT EXISTS "analytics_events_subject_occurred_idx" ON "analytics_events" ("subject_id", "occurred_at" DESC);
CREATE INDEX IF NOT EXISTS "analytics_events_store_occurred_idx" ON "analytics_events" ("store_id", "occurred_at" DESC);
