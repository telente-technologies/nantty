-- modify "subscriptions" table
ALTER TABLE "subscriptions" ADD COLUMN "offer_claim_id" character varying NOT NULL DEFAULT '', ADD COLUMN "offer_terms" jsonb NULL, ADD COLUMN "offer_cycles_remaining" bigint NOT NULL DEFAULT 0;
-- create "subscription_offer_claims" table
CREATE TABLE "subscription_offer_claims" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "link_id" character varying NOT NULL, "owner_user_id" character varying NOT NULL, "profile_id" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'reserved', "subscription_id" character varying NOT NULL DEFAULT '', "reserved_until" timestamptz NOT NULL, "redeemed_at" timestamptz NULL, "released_at" timestamptz NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "subscription_offer_claims_one_per_account" to table: "subscription_offer_claims"
CREATE UNIQUE INDEX "subscription_offer_claims_one_per_account" ON "subscription_offer_claims" ("link_id", "owner_user_id") WHERE ((status)::text = ANY ((ARRAY['reserved'::character varying, 'redeemed'::character varying])::text[]));
-- create index "subscriptionofferclaim_link_id_created_at" to table: "subscription_offer_claims"
CREATE INDEX "subscriptionofferclaim_link_id_created_at" ON "subscription_offer_claims" ("link_id", "created_at");
-- create index "subscriptionofferclaim_status_reserved_until" to table: "subscription_offer_claims"
CREATE INDEX "subscriptionofferclaim_status_reserved_until" ON "subscription_offer_claims" ("status", "reserved_until");
-- create "subscription_offer_links" table
CREATE TABLE "subscription_offer_links" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "token_hash" character varying NOT NULL, "token_salt" character varying NOT NULL, "label" character varying NOT NULL DEFAULT '', "plan_codes" jsonb NOT NULL, "discount_kind" character varying NOT NULL, "percent_off" bigint NOT NULL DEFAULT 0, "amount_off_minor" bigint NOT NULL DEFAULT 0, "amount_off_currency" character varying NOT NULL DEFAULT '', "single_use" boolean NOT NULL, "max_claims" bigint NOT NULL, "claimed_count" bigint NOT NULL DEFAULT 0, "redeemed_count" bigint NOT NULL DEFAULT 0, "duration_cycles" bigint NOT NULL, "expires_at" timestamptz NULL, "revoked_at" timestamptz NULL, "revoked_by_staff_id" character varying NOT NULL DEFAULT '', "created_by_staff_id" character varying NOT NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "subscriptionofferlink_created_at" to table: "subscription_offer_links"
CREATE INDEX "subscriptionofferlink_created_at" ON "subscription_offer_links" ("created_at");
-- create index "subscriptionofferlink_token_hash" to table: "subscription_offer_links"
CREATE UNIQUE INDEX "subscriptionofferlink_token_hash" ON "subscription_offer_links" ("token_hash");
-- create "subscription_offer_sends" table
CREATE TABLE "subscription_offer_sends" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "link_id" character varying NOT NULL, "recipient_email" character varying NOT NULL, "note" character varying NOT NULL DEFAULT '', "sent_by_staff_id" character varying NOT NULL, PRIMARY KEY ("id"));
-- create index "subscriptionoffersend_link_id_created_at" to table: "subscription_offer_sends"
CREATE INDEX "subscriptionoffersend_link_id_created_at" ON "subscription_offer_sends" ("link_id", "created_at");
