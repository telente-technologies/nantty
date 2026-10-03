-- create "ads" table
CREATE TABLE "ads" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "campaign_id" uuid NOT NULL, "ad_group_id" uuid NOT NULL, "name" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'draft', "review_status" character varying NOT NULL DEFAULT 'not_submitted', "policy_code" character varying NOT NULL DEFAULT '', "policy_reason" character varying NOT NULL DEFAULT '', "submitted_at" timestamptz NULL, "reviewed_at" timestamptz NULL, "reviewed_by_name" character varying NOT NULL DEFAULT '', "appeal_status" character varying NULL, "appeal_message" character varying NOT NULL DEFAULT '', "appeal_submitted_at" timestamptz NULL, "appeal_resolved_at" timestamptz NULL, "appeal_resolution_note" character varying NOT NULL DEFAULT '', "format" character varying NOT NULL, "creative" jsonb NOT NULL, "auto_check_flags" jsonb NOT NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "ad_account_id_status" to table: "ads"
CREATE INDEX "ad_account_id_status" ON "ads" ("account_id", "status");
-- create index "ad_ad_group_id" to table: "ads"
CREATE INDEX "ad_ad_group_id" ON "ads" ("ad_group_id");
-- create index "ad_campaign_id" to table: "ads"
CREATE INDEX "ad_campaign_id" ON "ads" ("campaign_id");
-- create index "ad_review_status_submitted_at" to table: "ads"
CREATE INDEX "ad_review_status_submitted_at" ON "ads" ("review_status", "submitted_at");
-- create "ad_accounts" table
CREATE TABLE "ad_accounts" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "name" character varying NOT NULL, "kind" character varying NOT NULL, "owner_user_id" uuid NOT NULL, "store_id" character varying NOT NULL DEFAULT '', "country_code" character varying NOT NULL, "currency" character varying NOT NULL, "timezone" character varying NOT NULL DEFAULT 'Africa/Lagos', "status" character varying NOT NULL DEFAULT 'active', "disabled_reason" character varying NOT NULL DEFAULT '', "balance_minor" bigint NOT NULL DEFAULT 0, "credit_minor" bigint NOT NULL DEFAULT 0, "credit_expires_at" timestamptz NULL, "amount_spent_micros" bigint NOT NULL DEFAULT 0, "spend_carry_micros" bigint NOT NULL DEFAULT 0, "spend_limit_minor" bigint NULL, "funding_mode" character varying NOT NULL DEFAULT 'prepaid', "verified_business" boolean NOT NULL DEFAULT false, "violation_count" bigint NOT NULL DEFAULT 0, "last_violation_at" timestamptz NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "ad_accounts_non_negative_balance" CHECK ((balance_minor >= 0) AND (credit_minor >= 0) AND (amount_spent_micros >= 0) AND (spend_carry_micros >= 0)));
-- create index "adaccount_owner_user_id" to table: "ad_accounts"
CREATE INDEX "adaccount_owner_user_id" ON "ad_accounts" ("owner_user_id");
-- create index "adaccount_status_created_at" to table: "ad_accounts"
CREATE INDEX "adaccount_status_created_at" ON "ad_accounts" ("status", "created_at");
-- create index "adaccount_store_id" to table: "ad_accounts"
CREATE UNIQUE INDEX "adaccount_store_id" ON "ad_accounts" ("store_id") WHERE ((store_id)::text <> ''::text);
-- create "ad_account_invites" table
CREATE TABLE "ad_account_invites" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "invitee_user_id" uuid NOT NULL, "invitee_username" character varying NOT NULL, "role" character varying NOT NULL, "invited_by_user_id" uuid NOT NULL, "invited_by_name" character varying NOT NULL DEFAULT '', "status" character varying NOT NULL DEFAULT 'pending', "expires_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "adaccountinvite_account_id_invitee_user_id" to table: "ad_account_invites"
CREATE UNIQUE INDEX "adaccountinvite_account_id_invitee_user_id" ON "ad_account_invites" ("account_id", "invitee_user_id") WHERE ((status)::text = 'pending'::text);
-- create index "adaccountinvite_account_id_status" to table: "ad_account_invites"
CREATE INDEX "adaccountinvite_account_id_status" ON "ad_account_invites" ("account_id", "status");
-- create index "adaccountinvite_invitee_user_id_status" to table: "ad_account_invites"
CREATE INDEX "adaccountinvite_invitee_user_id_status" ON "ad_account_invites" ("invitee_user_id", "status");
-- create "ad_account_members" table
CREATE TABLE "ad_account_members" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "user_id" uuid NOT NULL, "role" character varying NOT NULL, "is_owner" boolean NOT NULL DEFAULT false, "last_active_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "adaccountmember_account_id_user_id" to table: "ad_account_members"
CREATE UNIQUE INDEX "adaccountmember_account_id_user_id" ON "ad_account_members" ("account_id", "user_id");
-- create index "adaccountmember_user_id" to table: "ad_account_members"
CREATE INDEX "adaccountmember_user_id" ON "ad_account_members" ("user_id");
-- create "ad_activity_entries" table
CREATE TABLE "ad_activity_entries" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "object_type" character varying NOT NULL, "object_id" character varying NOT NULL, "actor_user_id" character varying NOT NULL DEFAULT '', "actor_name" character varying NOT NULL DEFAULT '', "summary" character varying NOT NULL, "changes" jsonb NOT NULL, PRIMARY KEY ("id"));
-- create index "adactivityentry_account_id_created_at" to table: "ad_activity_entries"
CREATE INDEX "adactivityentry_account_id_created_at" ON "ad_activity_entries" ("account_id", "created_at");
-- create index "adactivityentry_account_id_object_type_created_at" to table: "ad_activity_entries"
CREATE INDEX "adactivityentry_account_id_object_type_created_at" ON "ad_activity_entries" ("account_id", "object_type", "created_at");
-- create "ad_boosts" table
CREATE TABLE "ad_boosts" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "user_id" uuid NOT NULL, "post_id" character varying NOT NULL, "goal" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'pending_payment', "audience" jsonb NOT NULL, "currency" character varying NOT NULL, "daily_budget_minor" bigint NOT NULL, "duration_days" bigint NOT NULL, "total_budget_minor" bigint NOT NULL, "payment_method" character varying NOT NULL, "idempotency_key" character varying NOT NULL, "request_hash" character varying NOT NULL, "account_id" uuid NOT NULL, "campaign_id" uuid NOT NULL, "ad_group_id" uuid NOT NULL, "ad_id" uuid NOT NULL, "starts_at" timestamptz NULL, "ends_at" timestamptz NULL, "rejection_reason" character varying NOT NULL DEFAULT '', "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "adboost_campaign_id" to table: "ad_boosts"
CREATE INDEX "adboost_campaign_id" ON "ad_boosts" ("campaign_id");
-- create index "adboost_status_ends_at" to table: "ad_boosts"
CREATE INDEX "adboost_status_ends_at" ON "ad_boosts" ("status", "ends_at");
-- create index "adboost_user_id_created_at" to table: "ad_boosts"
CREATE INDEX "adboost_user_id_created_at" ON "ad_boosts" ("user_id", "created_at");
-- create index "adboost_user_id_idempotency_key" to table: "ad_boosts"
CREATE UNIQUE INDEX "adboost_user_id_idempotency_key" ON "ad_boosts" ("user_id", "idempotency_key");
-- create "ad_campaigns" table
CREATE TABLE "ad_campaigns" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "name" character varying NOT NULL, "objective" character varying NOT NULL, "kind" character varying NOT NULL DEFAULT 'standard', "status" character varying NOT NULL DEFAULT 'draft', "budget_level" character varying NOT NULL, "budget_type" character varying NULL, "budget_amount_minor" bigint NULL, "spend_cap_minor" bigint NULL, "start_at" timestamptz NOT NULL, "end_at" timestamptz NULL, "created_by_user_id" uuid NOT NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "adcampaign_account_id_status_created_at" to table: "ad_campaigns"
CREATE INDEX "adcampaign_account_id_status_created_at" ON "ad_campaigns" ("account_id", "status", "created_at");
-- create index "adcampaign_status_start_at" to table: "ad_campaigns"
CREATE INDEX "adcampaign_status_start_at" ON "ad_campaigns" ("status", "start_at");
-- create "ad_content_signals" table
CREATE TABLE "ad_content_signals" ("id" bigint NOT NULL GENERATED BY DEFAULT AS IDENTITY, "content_id" character varying NOT NULL, "creator_user_id" character varying NOT NULL DEFAULT '', "content_kind" character varying NOT NULL, "duration_seconds" bigint NOT NULL DEFAULT 0, "brand_safe" boolean NOT NULL DEFAULT true, "sensitive" boolean NOT NULL DEFAULT false, "kids_content" boolean NOT NULL DEFAULT false, "ai_generated" boolean NOT NULL DEFAULT false, "monetization_eligible" boolean NOT NULL DEFAULT false, "opted_in_placements" jsonb NOT NULL, "topics" jsonb NOT NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "ad_content_signals_content_id_key" to table: "ad_content_signals"
CREATE UNIQUE INDEX "ad_content_signals_content_id_key" ON "ad_content_signals" ("content_id");
-- create "ad_conversions" table
CREATE TABLE "ad_conversions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "conversion_id" character varying NOT NULL, "store_id" character varying NOT NULL, "user_id" character varying NOT NULL, "impression_id" uuid NOT NULL, "ad_id" uuid NOT NULL, "account_id" uuid NOT NULL, "value_minor" bigint NOT NULL, "currency" character varying NOT NULL, "occurred_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "adconversion_account_id_occurred_at" to table: "ad_conversions"
CREATE INDEX "adconversion_account_id_occurred_at" ON "ad_conversions" ("account_id", "occurred_at");
-- create index "adconversion_conversion_id" to table: "ad_conversions"
CREATE UNIQUE INDEX "adconversion_conversion_id" ON "ad_conversions" ("conversion_id");
-- create "ad_creator_earnings" table
CREATE TABLE "ad_creator_earnings" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "creator_user_id" character varying NOT NULL, "currency" character varying NOT NULL, "accrued_micros" bigint NOT NULL DEFAULT 0, "posted_minor" bigint NOT NULL DEFAULT 0, "qualified_impressions" bigint NOT NULL DEFAULT 0, PRIMARY KEY ("id"));
-- create index "adcreatorearning_creator_user_id_currency" to table: "ad_creator_earnings"
CREATE UNIQUE INDEX "adcreatorearning_creator_user_id_currency" ON "ad_creator_earnings" ("creator_user_id", "currency");
-- create "ad_frequency_policies" table
CREATE TABLE "ad_frequency_policies" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "format" character varying NOT NULL, "session_cap" bigint NOT NULL, "hour_cap" bigint NOT NULL, "day_cap" bigint NOT NULL, "advertiser_day_cap" bigint NOT NULL, "min_gap_slots" bigint NOT NULL, "cooldown_seconds_after_skip" bigint NOT NULL, "active" boolean NOT NULL DEFAULT true, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "adfrequencypolicy_format" to table: "ad_frequency_policies"
CREATE UNIQUE INDEX "adfrequencypolicy_format" ON "ad_frequency_policies" ("format");
-- create "ad_funds_transactions" table
CREATE TABLE "ad_funds_transactions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "type" character varying NOT NULL, "amount_minor" bigint NOT NULL, "currency" character varying NOT NULL, "description" character varying NOT NULL, "reference" character varying NOT NULL, PRIMARY KEY ("id"));
-- create index "adfundstransaction_account_id_created_at" to table: "ad_funds_transactions"
CREATE INDEX "adfundstransaction_account_id_created_at" ON "ad_funds_transactions" ("account_id", "created_at");
-- create index "adfundstransaction_account_id_reference" to table: "ad_funds_transactions"
CREATE UNIQUE INDEX "adfundstransaction_account_id_reference" ON "ad_funds_transactions" ("account_id", "reference");
-- create "ad_groups" table
CREATE TABLE "ad_groups" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "campaign_id" uuid NOT NULL, "name" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'draft', "audience" jsonb NOT NULL, "placement_mode" character varying NOT NULL DEFAULT 'automatic', "placements" jsonb NOT NULL, "start_at" timestamptz NOT NULL, "end_at" timestamptz NULL, "budget_type" character varying NULL, "budget_amount_minor" bigint NULL, "bid_type" character varying NOT NULL DEFAULT 'auto', "bid_amount_minor" bigint NULL, "frequency_cap_impressions" bigint NULL, "frequency_cap_per_days" bigint NULL, "conversion_event_id" character varying NOT NULL DEFAULT '', "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "adgroup_account_id_status" to table: "ad_groups"
CREATE INDEX "adgroup_account_id_status" ON "ad_groups" ("account_id", "status");
-- create index "adgroup_campaign_id" to table: "ad_groups"
CREATE INDEX "adgroup_campaign_id" ON "ad_groups" ("campaign_id");
-- create index "adgroup_status_start_at" to table: "ad_groups"
CREATE INDEX "adgroup_status_start_at" ON "ad_groups" ("status", "start_at");
-- create "ad_impressions" table
CREATE TABLE "ad_impressions" ("id" uuid NOT NULL, "served_at" timestamptz NOT NULL, "ad_id" uuid NOT NULL, "ad_group_id" uuid NOT NULL, "campaign_id" uuid NOT NULL, "account_id" uuid NOT NULL, "user_id" character varying NOT NULL, "session_id" character varying NOT NULL, "placement" character varying NOT NULL, "slot_kind" character varying NOT NULL, "content_id" character varying NOT NULL DEFAULT '', "creator_user_id" character varying NOT NULL DEFAULT '', "country" character varying NOT NULL DEFAULT '', "region" character varying NOT NULL DEFAULT '', "age_band" character varying NOT NULL DEFAULT '', "gender" character varying NOT NULL DEFAULT '', "ai_generated" boolean NOT NULL DEFAULT false, "currency" character varying NOT NULL, "basis" character varying NOT NULL, "price_micros" bigint NOT NULL, "pctr_ppm" bigint NOT NULL, "creator_share_bps" bigint NOT NULL DEFAULT 0, "creator_multiplier_bps" bigint NOT NULL DEFAULT 10000, "viewed_at" timestamptz NULL, "watch_ms" bigint NOT NULL DEFAULT 0, "completed" boolean NOT NULL DEFAULT false, "clicked_at" timestamptz NULL, "click_count" bigint NOT NULL DEFAULT 0, "qualified" boolean NOT NULL DEFAULT false, "qualified_at" timestamptz NULL, "fraud_status" character varying NOT NULL DEFAULT 'pending', "fraud_score" double precision NOT NULL DEFAULT 0, "fraud_reason" character varying NOT NULL DEFAULT '', "charge_micros" bigint NOT NULL DEFAULT 0, "creator_share_micros" bigint NOT NULL DEFAULT 0, "platform_share_micros" bigint NOT NULL DEFAULT 0, "settlement_batch_id" uuid NULL, PRIMARY KEY ("id"), CONSTRAINT "ad_impressions_non_negative_money" CHECK ((charge_micros >= 0) AND (creator_share_micros >= 0) AND (platform_share_micros >= 0) AND (price_micros >= 0) AND ((creator_share_micros + platform_share_micros) = charge_micros)));
-- create index "adimpression_fraud_status_served_at" to table: "ad_impressions"
CREATE INDEX "adimpression_fraud_status_served_at" ON "ad_impressions" ("fraud_status", "served_at") WHERE ((charge_micros > 0) AND (settlement_batch_id IS NULL));
-- create index "adimpression_served_at" to table: "ad_impressions"
CREATE INDEX "adimpression_served_at" ON "ad_impressions" USING brin ("served_at");
-- create index "adimpression_user_id_clicked_at" to table: "ad_impressions"
CREATE INDEX "adimpression_user_id_clicked_at" ON "ad_impressions" ("user_id", "clicked_at") WHERE (clicked_at IS NOT NULL);
-- create "ad_monetization_policies" table
CREATE TABLE "ad_monetization_policies" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "key" character varying NOT NULL, "revenue_source" character varying NOT NULL DEFAULT 'ads', "content_type" character varying NOT NULL, "creator_share_bps" bigint NOT NULL, "multiplier_bps" bigint NOT NULL, "effective_from" timestamptz NOT NULL, "effective_to" timestamptz NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "admonetizationpolicy_key" to table: "ad_monetization_policies"
CREATE UNIQUE INDEX "admonetizationpolicy_key" ON "ad_monetization_policies" ("key");
-- create index "admonetizationpolicy_revenue_source_content_type" to table: "ad_monetization_policies"
CREATE INDEX "admonetizationpolicy_revenue_source_content_type" ON "ad_monetization_policies" ("revenue_source", "content_type");
-- create "ad_policy_categories" table
CREATE TABLE "ad_policy_categories" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "code" character varying NOT NULL, "name" character varying NOT NULL, "description" character varying NOT NULL, "severity" character varying NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "rejection_count" bigint NOT NULL DEFAULT 0, "created_by" uuid NULL, PRIMARY KEY ("id"));
-- create index "adpolicycategory_code" to table: "ad_policy_categories"
CREATE UNIQUE INDEX "adpolicycategory_code" ON "ad_policy_categories" ("code");
-- create index "adpolicycategory_name" to table: "ad_policy_categories"
CREATE UNIQUE INDEX "adpolicycategory_name" ON "ad_policy_categories" ("name");
-- create "ad_pool_dailies" table
CREATE TABLE "ad_pool_dailies" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "day" character varying NOT NULL, "currency" character varying NOT NULL, "gross_micros" bigint NOT NULL DEFAULT 0, "creator_pool_micros" bigint NOT NULL DEFAULT 0, "platform_pool_micros" bigint NOT NULL DEFAULT 0, "qualified_impressions" bigint NOT NULL DEFAULT 0, PRIMARY KEY ("id"));
-- create index "adpooldaily_day_currency" to table: "ad_pool_dailies"
CREATE UNIQUE INDEX "adpooldaily_day_currency" ON "ad_pool_dailies" ("day", "currency");
-- create "ad_spend_batches" table
CREATE TABLE "ad_spend_batches" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "currency" character varying NOT NULL, "impression_count" bigint NOT NULL, "spend_micros" bigint NOT NULL, "debited_minor" bigint NOT NULL, "creator_share_micros" bigint NOT NULL, "platform_share_micros" bigint NOT NULL, PRIMARY KEY ("id"));
-- create index "adspendbatch_account_id_created_at" to table: "ad_spend_batches"
CREATE INDEX "adspendbatch_account_id_created_at" ON "ad_spend_batches" ("account_id", "created_at");
-- create "ad_stats_dailies" table
CREATE TABLE "ad_stats_dailies" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "day" character varying NOT NULL, "account_id" uuid NOT NULL, "campaign_id" uuid NOT NULL, "ad_group_id" uuid NOT NULL, "ad_id" uuid NOT NULL, "placement" character varying NOT NULL, "country" character varying NOT NULL DEFAULT '', "region" character varying NOT NULL DEFAULT '', "age_band" character varying NOT NULL DEFAULT '', "gender" character varying NOT NULL DEFAULT '', "impressions" bigint NOT NULL DEFAULT 0, "qualified_impressions" bigint NOT NULL DEFAULT 0, "reach" bigint NOT NULL DEFAULT 0, "clicks" bigint NOT NULL DEFAULT 0, "spend_micros" bigint NOT NULL DEFAULT 0, "video_views" bigint NOT NULL DEFAULT 0, "watch_ms_total" bigint NOT NULL DEFAULT 0, "conversions" bigint NOT NULL DEFAULT 0, "conversion_value_minor" bigint NOT NULL DEFAULT 0, PRIMARY KEY ("id"));
-- create index "adstatsdaily_account_id_day" to table: "ad_stats_dailies"
CREATE INDEX "adstatsdaily_account_id_day" ON "ad_stats_dailies" ("account_id", "day");
-- create index "adstatsdaily_campaign_id_day" to table: "ad_stats_dailies"
CREATE INDEX "adstatsdaily_campaign_id_day" ON "ad_stats_dailies" ("campaign_id", "day");
-- create index "adstatsdaily_day_ad_id_placement_country_region_age_band_gender" to table: "ad_stats_dailies"
CREATE UNIQUE INDEX "adstatsdaily_day_ad_id_placement_country_region_age_band_gender" ON "ad_stats_dailies" ("day", "ad_id", "placement", "country", "region", "age_band", "gender");
-- create "outbox_events" table
CREATE TABLE "outbox_events" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "event_type" character varying NOT NULL, "subject" character varying NOT NULL, "payload" jsonb NOT NULL, "published_at" timestamptz NULL, "attempt_count" bigint NOT NULL DEFAULT 0, "next_attempt_at" timestamptz NULL, "last_error" character varying NOT NULL DEFAULT '', "dead_lettered_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "outboxevent_published_at_dead_lettered_at_created_at" to table: "outbox_events"
CREATE INDEX "outboxevent_published_at_dead_lettered_at_created_at" ON "outbox_events" ("published_at", "dead_lettered_at", "created_at");
