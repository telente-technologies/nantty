CREATE TABLE "space_participants" (
  "id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "space_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "role" character varying NOT NULL DEFAULT 'listener',
  "state" character varying NOT NULL DEFAULT 'active',
  "muted_by_host" boolean NOT NULL DEFAULT false,
  "joined_at" timestamptz NOT NULL,
  "last_seen_at" timestamptz NOT NULL,
  "left_at" timestamptz NULL,
  PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "spaceparticipant_space_id_account_id" ON "space_participants" ("space_id", "account_id");
CREATE INDEX "spaceparticipant_space_id_state_role" ON "space_participants" ("space_id", "state", "role");
CREATE INDEX "spaceparticipant_state_last_seen_at" ON "space_participants" ("state", "last_seen_at");
CREATE TABLE "space_speaker_requests" (
  "id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "space_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "state" character varying NOT NULL DEFAULT 'pending',
  "decided_by" uuid NULL,
  "decided_at" timestamptz NULL,
  "expires_at" timestamptz NOT NULL,
  PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "spacespeakerrequest_space_id_account_id" ON "space_speaker_requests" ("space_id", "account_id") WHERE ((state)::text = 'pending'::text);
CREATE INDEX "spacespeakerrequest_space_id_state_created_at" ON "space_speaker_requests" ("space_id", "state", "created_at");
CREATE INDEX "spacespeakerrequest_state_expires_at" ON "space_speaker_requests" ("state", "expires_at");
