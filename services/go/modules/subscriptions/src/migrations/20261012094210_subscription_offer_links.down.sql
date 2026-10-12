-- reverse: create index "subscriptionoffersend_link_id_created_at" to table: "subscription_offer_sends"
DROP INDEX "subscriptionoffersend_link_id_created_at";
-- reverse: create "subscription_offer_sends" table
DROP TABLE "subscription_offer_sends";
-- reverse: create index "subscriptionofferlink_token_hash" to table: "subscription_offer_links"
DROP INDEX "subscriptionofferlink_token_hash";
-- reverse: create index "subscriptionofferlink_created_at" to table: "subscription_offer_links"
DROP INDEX "subscriptionofferlink_created_at";
-- reverse: create "subscription_offer_links" table
DROP TABLE "subscription_offer_links";
-- reverse: create index "subscriptionofferclaim_status_reserved_until" to table: "subscription_offer_claims"
DROP INDEX "subscriptionofferclaim_status_reserved_until";
-- reverse: create index "subscriptionofferclaim_link_id_created_at" to table: "subscription_offer_claims"
DROP INDEX "subscriptionofferclaim_link_id_created_at";
-- reverse: create index "subscription_offer_claims_one_per_account" to table: "subscription_offer_claims"
DROP INDEX "subscription_offer_claims_one_per_account";
-- reverse: create "subscription_offer_claims" table
DROP TABLE "subscription_offer_claims";
-- reverse: modify "subscriptions" table
ALTER TABLE "subscriptions" DROP COLUMN "offer_cycles_remaining", DROP COLUMN "offer_terms", DROP COLUMN "offer_claim_id";
