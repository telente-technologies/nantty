-- reverse: create index "outboxevent_published_at_dead_lettered_at_created_at" to table: "outbox_events"
DROP INDEX "outboxevent_published_at_dead_lettered_at_created_at";
-- reverse: create "outbox_events" table
DROP TABLE "outbox_events";
-- reverse: create index "adstatsdaily_day_ad_id_placement_country_region_age_band_gender" to table: "ad_stats_dailies"
DROP INDEX "adstatsdaily_day_ad_id_placement_country_region_age_band_gender";
-- reverse: create index "adstatsdaily_campaign_id_day" to table: "ad_stats_dailies"
DROP INDEX "adstatsdaily_campaign_id_day";
-- reverse: create index "adstatsdaily_account_id_day" to table: "ad_stats_dailies"
DROP INDEX "adstatsdaily_account_id_day";
-- reverse: create "ad_stats_dailies" table
DROP TABLE "ad_stats_dailies";
-- reverse: create index "adspendbatch_account_id_created_at" to table: "ad_spend_batches"
DROP INDEX "adspendbatch_account_id_created_at";
-- reverse: create "ad_spend_batches" table
DROP TABLE "ad_spend_batches";
-- reverse: create index "adpooldaily_day_currency" to table: "ad_pool_dailies"
DROP INDEX "adpooldaily_day_currency";
-- reverse: create "ad_pool_dailies" table
DROP TABLE "ad_pool_dailies";
-- reverse: create index "adpolicycategory_name" to table: "ad_policy_categories"
DROP INDEX "adpolicycategory_name";
-- reverse: create index "adpolicycategory_code" to table: "ad_policy_categories"
DROP INDEX "adpolicycategory_code";
-- reverse: create "ad_policy_categories" table
DROP TABLE "ad_policy_categories";
-- reverse: create index "admonetizationpolicy_revenue_source_content_type" to table: "ad_monetization_policies"
DROP INDEX "admonetizationpolicy_revenue_source_content_type";
-- reverse: create index "admonetizationpolicy_key" to table: "ad_monetization_policies"
DROP INDEX "admonetizationpolicy_key";
-- reverse: create "ad_monetization_policies" table
DROP TABLE "ad_monetization_policies";
-- reverse: create index "adimpression_user_id_clicked_at" to table: "ad_impressions"
DROP INDEX "adimpression_user_id_clicked_at";
-- reverse: create index "adimpression_served_at" to table: "ad_impressions"
DROP INDEX "adimpression_served_at";
-- reverse: create index "adimpression_fraud_status_served_at" to table: "ad_impressions"
DROP INDEX "adimpression_fraud_status_served_at";
-- reverse: create "ad_impressions" table
DROP TABLE "ad_impressions";
-- reverse: create index "adgroup_status_start_at" to table: "ad_groups"
DROP INDEX "adgroup_status_start_at";
-- reverse: create index "adgroup_campaign_id" to table: "ad_groups"
DROP INDEX "adgroup_campaign_id";
-- reverse: create index "adgroup_account_id_status" to table: "ad_groups"
DROP INDEX "adgroup_account_id_status";
-- reverse: create "ad_groups" table
DROP TABLE "ad_groups";
-- reverse: create index "adfundstransaction_account_id_reference" to table: "ad_funds_transactions"
DROP INDEX "adfundstransaction_account_id_reference";
-- reverse: create index "adfundstransaction_account_id_created_at" to table: "ad_funds_transactions"
DROP INDEX "adfundstransaction_account_id_created_at";
-- reverse: create "ad_funds_transactions" table
DROP TABLE "ad_funds_transactions";
-- reverse: create index "adfrequencypolicy_format" to table: "ad_frequency_policies"
DROP INDEX "adfrequencypolicy_format";
-- reverse: create "ad_frequency_policies" table
DROP TABLE "ad_frequency_policies";
-- reverse: create index "adcreatorearning_creator_user_id_currency" to table: "ad_creator_earnings"
DROP INDEX "adcreatorearning_creator_user_id_currency";
-- reverse: create "ad_creator_earnings" table
DROP TABLE "ad_creator_earnings";
-- reverse: create index "adconversion_conversion_id" to table: "ad_conversions"
DROP INDEX "adconversion_conversion_id";
-- reverse: create index "adconversion_account_id_occurred_at" to table: "ad_conversions"
DROP INDEX "adconversion_account_id_occurred_at";
-- reverse: create "ad_conversions" table
DROP TABLE "ad_conversions";
-- reverse: create index "ad_content_signals_content_id_key" to table: "ad_content_signals"
DROP INDEX "ad_content_signals_content_id_key";
-- reverse: create "ad_content_signals" table
DROP TABLE "ad_content_signals";
-- reverse: create index "adcampaign_status_start_at" to table: "ad_campaigns"
DROP INDEX "adcampaign_status_start_at";
-- reverse: create index "adcampaign_account_id_status_created_at" to table: "ad_campaigns"
DROP INDEX "adcampaign_account_id_status_created_at";
-- reverse: create "ad_campaigns" table
DROP TABLE "ad_campaigns";
-- reverse: create index "adboost_user_id_idempotency_key" to table: "ad_boosts"
DROP INDEX "adboost_user_id_idempotency_key";
-- reverse: create index "adboost_user_id_created_at" to table: "ad_boosts"
DROP INDEX "adboost_user_id_created_at";
-- reverse: create index "adboost_status_ends_at" to table: "ad_boosts"
DROP INDEX "adboost_status_ends_at";
-- reverse: create index "adboost_campaign_id" to table: "ad_boosts"
DROP INDEX "adboost_campaign_id";
-- reverse: create "ad_boosts" table
DROP TABLE "ad_boosts";
-- reverse: create index "adactivityentry_account_id_object_type_created_at" to table: "ad_activity_entries"
DROP INDEX "adactivityentry_account_id_object_type_created_at";
-- reverse: create index "adactivityentry_account_id_created_at" to table: "ad_activity_entries"
DROP INDEX "adactivityentry_account_id_created_at";
-- reverse: create "ad_activity_entries" table
DROP TABLE "ad_activity_entries";
-- reverse: create index "adaccountmember_user_id" to table: "ad_account_members"
DROP INDEX "adaccountmember_user_id";
-- reverse: create index "adaccountmember_account_id_user_id" to table: "ad_account_members"
DROP INDEX "adaccountmember_account_id_user_id";
-- reverse: create "ad_account_members" table
DROP TABLE "ad_account_members";
-- reverse: create index "adaccountinvite_invitee_user_id_status" to table: "ad_account_invites"
DROP INDEX "adaccountinvite_invitee_user_id_status";
-- reverse: create index "adaccountinvite_account_id_status" to table: "ad_account_invites"
DROP INDEX "adaccountinvite_account_id_status";
-- reverse: create index "adaccountinvite_account_id_invitee_user_id" to table: "ad_account_invites"
DROP INDEX "adaccountinvite_account_id_invitee_user_id";
-- reverse: create "ad_account_invites" table
DROP TABLE "ad_account_invites";
-- reverse: create index "adaccount_store_id" to table: "ad_accounts"
DROP INDEX "adaccount_store_id";
-- reverse: create index "adaccount_status_created_at" to table: "ad_accounts"
DROP INDEX "adaccount_status_created_at";
-- reverse: create index "adaccount_owner_user_id" to table: "ad_accounts"
DROP INDEX "adaccount_owner_user_id";
-- reverse: create "ad_accounts" table
DROP TABLE "ad_accounts";
-- reverse: create index "ad_review_status_submitted_at" to table: "ads"
DROP INDEX "ad_review_status_submitted_at";
-- reverse: create index "ad_campaign_id" to table: "ads"
DROP INDEX "ad_campaign_id";
-- reverse: create index "ad_ad_group_id" to table: "ads"
DROP INDEX "ad_ad_group_id";
-- reverse: create index "ad_account_id_status" to table: "ads"
DROP INDEX "ad_account_id_status";
-- reverse: create "ads" table
DROP TABLE "ads";
