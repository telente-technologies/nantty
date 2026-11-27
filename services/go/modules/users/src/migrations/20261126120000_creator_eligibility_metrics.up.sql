ALTER TABLE "profile_signals"
  ADD COLUMN "verified_followers" integer NOT NULL DEFAULT 0,
  ADD COLUMN "creator_real_followers" integer NOT NULL DEFAULT 0,
  ADD COLUMN "creator_original_posts_last_60_days" integer NOT NULL DEFAULT 0,
  ADD COLUMN "creator_days_since_last_violation" integer NOT NULL DEFAULT 0,
  ADD COLUMN "creator_standing_available" boolean NOT NULL DEFAULT false,
  ADD COLUMN "creator_standing_source" character varying(48) NOT NULL DEFAULT '',
  ADD COLUMN "creator_standing_as_of" timestamptz NULL,
  ADD COLUMN "creator_standing_snapshot_id" uuid NULL,
  ADD COLUMN "qualifying_impressions_last_30_days" integer NOT NULL DEFAULT 0,
  ADD COLUMN "creator_metrics_source" character varying(48) NOT NULL DEFAULT '',
  ADD COLUMN "creator_metrics_as_of" timestamptz NULL,
  ADD COLUMN "creator_metrics_snapshot_id" uuid NULL;

ALTER TABLE "profile_signals"
  ADD CONSTRAINT "profile_signals_verified_followers_non_negative" CHECK ("verified_followers" >= 0),
  ADD CONSTRAINT "profile_signals_creator_real_followers_non_negative" CHECK ("creator_real_followers" >= 0),
  ADD CONSTRAINT "profile_signals_creator_original_posts_non_negative" CHECK ("creator_original_posts_last_60_days" >= 0),
  ADD CONSTRAINT "profile_signals_creator_days_since_violation_non_negative" CHECK ("creator_days_since_last_violation" >= 0),
  ADD CONSTRAINT "profile_signals_qualifying_impressions_non_negative" CHECK ("qualifying_impressions_last_30_days" >= 0);

CREATE TABLE "creator_eligibility_metric_snapshots" (
  "snapshot_id" uuid PRIMARY KEY,
  "profile_id" uuid NOT NULL REFERENCES "profiles" ("id") ON DELETE CASCADE,
  "account_id" uuid NOT NULL,
  "source" character varying(48) NOT NULL,
  "metrics_as_of" timestamptz NOT NULL,
  "real_followers" integer NOT NULL CHECK ("real_followers" >= 0),
  "verified_followers" integer NOT NULL CHECK ("verified_followers" >= 0),
  "qualifying_impressions_last_30_days" integer NOT NULL CHECK ("qualifying_impressions_last_30_days" >= 0),
  "original_posts_last_60_days" integer NOT NULL CHECK ("original_posts_last_60_days" >= 0),
  "recorded_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "creator_eligibility_metric_snapshots_profile_as_of" ON "creator_eligibility_metric_snapshots" ("profile_id", "metrics_as_of" DESC);
CREATE TABLE "creator_policy_standing_snapshots" (
  "snapshot_id" uuid PRIMARY KEY,
  "profile_id" uuid NOT NULL REFERENCES "profiles" ("id") ON DELETE CASCADE,
  "account_id" uuid NOT NULL,
  "source" character varying(48) NOT NULL,
  "standing_as_of" timestamptz NOT NULL,
  "days_since_last_violation" integer NOT NULL CHECK ("days_since_last_violation" >= 0),
  "recorded_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "creator_policy_standing_snapshots_profile_as_of" ON "creator_policy_standing_snapshots" ("profile_id", "standing_as_of" DESC);
