-- reverse: create index "subscriptioncoveredprofile_subscription_id_status" to table: "subscription_covered_profiles"
DROP INDEX "subscriptioncoveredprofile_subscription_id_status";
-- reverse: create index "subscription_covered_profiles_live_per_profile" to table: "subscription_covered_profiles"
DROP INDEX "subscription_covered_profiles_live_per_profile";
-- reverse: create "subscription_covered_profiles" table
DROP TABLE "subscription_covered_profiles";
