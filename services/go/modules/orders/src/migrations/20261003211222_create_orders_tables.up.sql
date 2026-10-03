-- create "carts" table
CREATE TABLE "carts" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "cart_account_id" to table: "carts"
CREATE UNIQUE INDEX "cart_account_id" ON "carts" ("account_id");
-- create "cart_items" table
CREATE TABLE "cart_items" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "cart_id" uuid NOT NULL, "product_id" uuid NOT NULL, "variant_id" uuid NOT NULL, "store_id" uuid NOT NULL, "quantity" bigint NOT NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "cartitem_cart_id_variant_id" to table: "cart_items"
CREATE UNIQUE INDEX "cartitem_cart_id_variant_id" ON "cart_items" ("cart_id", "variant_id");
-- create index "cartitem_variant_id" to table: "cart_items"
CREATE INDEX "cartitem_variant_id" ON "cart_items" ("variant_id");
-- create "checkouts" table
CREATE TABLE "checkouts" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "buyer_account_id" uuid NOT NULL, "idempotency_key" character varying NOT NULL, "request_hash" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'registering', "currency" character varying NOT NULL, "total_minor" bigint NOT NULL, "address" jsonb NOT NULL, "stock_reserved" boolean NOT NULL DEFAULT false, "expires_at" timestamptz NOT NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "checkout_buyer_account_id_idempotency_key" to table: "checkouts"
CREATE UNIQUE INDEX "checkout_buyer_account_id_idempotency_key" ON "checkouts" ("buyer_account_id", "idempotency_key");
-- create index "checkout_open_expiry" to table: "checkouts"
CREATE INDEX "checkout_open_expiry" ON "checkouts" ("expires_at") WHERE ((status)::text = ANY ((ARRAY['registering'::character varying, 'payable'::character varying])::text[]));
-- create "customer_notes" table
CREATE TABLE "customer_notes" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "buyer_account_id" uuid NOT NULL, "author_account_id" uuid NOT NULL, "author_name" character varying NOT NULL DEFAULT '', "body" character varying NOT NULL, PRIMARY KEY ("id"));
-- create index "customernote_store_id_buyer_account_id_id" to table: "customer_notes"
CREATE INDEX "customernote_store_id_buyer_account_id_id" ON "customer_notes" ("store_id", "buyer_account_id", "id");
-- create "idempotent_requests" table
CREATE TABLE "idempotent_requests" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "scope" character varying NOT NULL, "key" character varying NOT NULL, "request_hash" character varying NOT NULL, "response_body" jsonb NULL, PRIMARY KEY ("id"));
-- create index "idempotentrequest_scope_key" to table: "idempotent_requests"
CREATE UNIQUE INDEX "idempotentrequest_scope_key" ON "idempotent_requests" ("scope", "key");
-- create "order_events" table
CREATE TABLE "order_events" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "order_group_id" uuid NOT NULL, "kind" character varying NOT NULL, "summary" character varying NOT NULL DEFAULT '', "actor_kind" character varying NOT NULL DEFAULT 'system', "actor_account_id" uuid NULL, "actor_name" character varying NOT NULL DEFAULT '', PRIMARY KEY ("id"));
-- create index "orderevent_order_group_id_id" to table: "order_events"
CREATE INDEX "orderevent_order_group_id_id" ON "order_events" ("order_group_id", "id");
-- create "order_groups" table
CREATE TABLE "order_groups" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "checkout_id" uuid NOT NULL, "reference" character varying NOT NULL, "invoice_number" character varying NOT NULL, "store_id" uuid NOT NULL, "seller_account_id" uuid NOT NULL, "buyer_account_id" uuid NOT NULL, "buyer_name" character varying NOT NULL DEFAULT '', "buyer_username" character varying NOT NULL DEFAULT '', "status" character varying NOT NULL DEFAULT 'pending', "previous_status" character varying NOT NULL DEFAULT '', "payment_status" character varying NOT NULL DEFAULT 'pending', "delivery_status" character varying NOT NULL DEFAULT 'pending', "currency" character varying NOT NULL, "subtotal_minor" bigint NOT NULL, "discount_minor" bigint NOT NULL DEFAULT 0, "promotion_id" uuid NULL, "store_credit_minor" bigint NOT NULL DEFAULT 0, "shipping_minor" bigint NOT NULL, "total_minor" bigint NOT NULL, "refunded_minor" bigint NOT NULL DEFAULT 0, "address" jsonb NOT NULL, "stock_reserved" boolean NOT NULL DEFAULT false, "courier_name" character varying NULL, "tracking_number" character varying NULL, "tracking_url" character varying NULL, "from_location_id" uuid NULL, "rider_name" character varying NULL, "rider_phone" character varying NULL, "delivery_attempts" bigint NOT NULL DEFAULT 0, "last_attempt_note" character varying NULL, "estimated_delivery_at" timestamptz NULL, "paid_at" timestamptz NULL, "shipped_at" timestamptz NULL, "delivered_at" timestamptz NULL, "completed_at" timestamptz NULL, "escrow_release_at" timestamptz NULL, "refund_requested_at" timestamptz NULL, "cancel_reason" character varying NULL, "version" bigint NOT NULL DEFAULT 1, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "ordergroup_buyer_newest" to table: "order_groups"
CREATE INDEX "ordergroup_buyer_newest" ON "order_groups" ("buyer_account_id", "id" DESC);
-- create index "ordergroup_buyer_status_newest" to table: "order_groups"
CREATE INDEX "ordergroup_buyer_status_newest" ON "order_groups" ("buyer_account_id", "status", "id" DESC);
-- create index "ordergroup_checkout_id" to table: "order_groups"
CREATE INDEX "ordergroup_checkout_id" ON "order_groups" ("checkout_id");
-- create index "ordergroup_delivered_release" to table: "order_groups"
CREATE INDEX "ordergroup_delivered_release" ON "order_groups" ("escrow_release_at") WHERE ((status)::text = 'delivered'::text);
-- create index "ordergroup_reference" to table: "order_groups"
CREATE UNIQUE INDEX "ordergroup_reference" ON "order_groups" ("reference");
-- create index "ordergroup_store_id_buyer_account_id" to table: "order_groups"
CREATE INDEX "ordergroup_store_id_buyer_account_id" ON "order_groups" ("store_id", "buyer_account_id");
-- create index "ordergroup_store_id_invoice_number" to table: "order_groups"
CREATE UNIQUE INDEX "ordergroup_store_id_invoice_number" ON "order_groups" ("store_id", "invoice_number");
-- create index "ordergroup_store_status_newest" to table: "order_groups"
CREATE INDEX "ordergroup_store_status_newest" ON "order_groups" ("store_id", "status", "id" DESC);
-- create "order_items" table
CREATE TABLE "order_items" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "order_group_id" uuid NOT NULL, "store_id" uuid NOT NULL, "product_id" uuid NOT NULL, "variant_id" uuid NOT NULL, "product_name" character varying NOT NULL, "variant_title" character varying NOT NULL DEFAULT '', "sku" character varying NOT NULL DEFAULT '', "size" character varying NOT NULL DEFAULT '', "color" character varying NOT NULL DEFAULT '', "image_url" character varying NULL, "unit_price_minor" bigint NOT NULL, "quantity" bigint NOT NULL, "line_total_minor" bigint NOT NULL, "cost_price_minor" bigint NULL, "category_id" uuid NULL, "category_name" character varying NOT NULL DEFAULT '', "tracks_stock" boolean NOT NULL DEFAULT true, PRIMARY KEY ("id"));
-- create index "orderitem_order_group_id" to table: "order_items"
CREATE INDEX "orderitem_order_group_id" ON "order_items" ("order_group_id");
-- create index "orderitem_product_id" to table: "order_items"
CREATE INDEX "orderitem_product_id" ON "order_items" ("product_id");
-- create index "orderitem_store_id_product_id" to table: "order_items"
CREATE INDEX "orderitem_store_id_product_id" ON "order_items" ("store_id", "product_id");
-- create "order_notes" table
CREATE TABLE "order_notes" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "order_group_id" uuid NOT NULL, "author_account_id" uuid NOT NULL, "author_name" character varying NOT NULL DEFAULT '', "body" character varying NOT NULL, PRIMARY KEY ("id"));
-- create index "ordernote_order_group_id_id" to table: "order_notes"
CREATE INDEX "ordernote_order_group_id_id" ON "order_notes" ("order_group_id", "id");
-- create "outbox_events" table
CREATE TABLE "outbox_events" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "event_type" character varying NOT NULL, "subject" character varying NOT NULL, "payload" jsonb NOT NULL, "published_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "outboxevent_published_at_created_at" to table: "outbox_events"
CREATE INDEX "outboxevent_published_at_created_at" ON "outbox_events" ("published_at", "created_at");
-- create "processed_events" table
CREATE TABLE "processed_events" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "envelope_id" character varying NOT NULL, "event_type" character varying NOT NULL, PRIMARY KEY ("id"));
-- create index "processedevent_envelope_id" to table: "processed_events"
CREATE UNIQUE INDEX "processedevent_envelope_id" ON "processed_events" ("envelope_id");
-- create "promotions" table
CREATE TABLE "promotions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "name" character varying NOT NULL, "kind" character varying NOT NULL, "code" character varying NULL, "discount_kind" character varying NOT NULL, "discount_value" bigint NOT NULL, "scope_kind" character varying NOT NULL DEFAULT 'all', "scope_ids" jsonb NULL, "minimum_spend_minor" bigint NULL, "usage_limit" bigint NULL, "usage_limit_per_customer" bigint NULL, "used_count" bigint NOT NULL DEFAULT 0, "starts_at" timestamptz NOT NULL, "ends_at" timestamptz NULL, "disabled" boolean NOT NULL DEFAULT false, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "promotion_store_code_unique" to table: "promotions"
CREATE UNIQUE INDEX "promotion_store_code_unique" ON "promotions" ("store_id", "code") WHERE (code IS NOT NULL);
-- create index "promotion_store_id_id" to table: "promotions"
CREATE INDEX "promotion_store_id_id" ON "promotions" ("store_id", "id" DESC);
-- create index "promotion_store_id_kind_starts_at" to table: "promotions"
CREATE INDEX "promotion_store_id_kind_starts_at" ON "promotions" ("store_id", "kind", "starts_at");
-- create "promotion_redemptions" table
CREATE TABLE "promotion_redemptions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "promotion_id" uuid NOT NULL, "order_group_id" uuid NOT NULL, "buyer_account_id" uuid NOT NULL, "discount_minor" bigint NOT NULL, PRIMARY KEY ("id"));
-- create index "promotionredemption_order_group_id" to table: "promotion_redemptions"
CREATE UNIQUE INDEX "promotionredemption_order_group_id" ON "promotion_redemptions" ("order_group_id");
-- create index "promotionredemption_promotion_id_buyer_account_id" to table: "promotion_redemptions"
CREATE INDEX "promotionredemption_promotion_id_buyer_account_id" ON "promotion_redemptions" ("promotion_id", "buyer_account_id");
-- create "report_export_jobs" table
CREATE TABLE "report_export_jobs" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "requested_by_account_id" uuid NOT NULL, "kind" character varying NOT NULL, "from_date" timestamptz NOT NULL, "to_date" timestamptz NOT NULL, "status" character varying NOT NULL DEFAULT 'queued', "csv_content" text NULL, "row_count" bigint NOT NULL DEFAULT 0, "error_message" character varying NULL, "completed_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "reportexport_queued" to table: "report_export_jobs"
CREATE INDEX "reportexport_queued" ON "report_export_jobs" ("status", "id") WHERE ((status)::text = 'queued'::text);
-- create index "reportexportjob_store_id_id" to table: "report_export_jobs"
CREATE INDEX "reportexportjob_store_id_id" ON "report_export_jobs" ("store_id", "id" DESC);
-- create "return_requests" table
CREATE TABLE "return_requests" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "order_group_id" uuid NOT NULL, "store_id" uuid NOT NULL, "buyer_account_id" uuid NOT NULL, "reason" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'requested', "decline_note" character varying NULL, "refund_amount_minor" bigint NOT NULL, "currency" character varying NOT NULL, "lines" jsonb NOT NULL, "restocked" boolean NOT NULL DEFAULT false, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "returnrequest_buyer_newest" to table: "return_requests"
CREATE INDEX "returnrequest_buyer_newest" ON "return_requests" ("buyer_account_id", "id" DESC);
-- create index "returnrequest_order_group_id_status" to table: "return_requests"
CREATE INDEX "returnrequest_order_group_id_status" ON "return_requests" ("order_group_id", "status");
-- create index "returnrequest_store_status_newest" to table: "return_requests"
CREATE INDEX "returnrequest_store_status_newest" ON "return_requests" ("store_id", "status", "id" DESC);
-- create "shipping_calculations" table
CREATE TABLE "shipping_calculations" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "order_group_id" uuid NOT NULL, "profile_id" uuid NULL, "zone_id" uuid NULL, "rule_id" uuid NULL, "outcome" character varying NOT NULL, "matched_level" character varying NOT NULL DEFAULT '', "zone_name" character varying NOT NULL DEFAULT '', "destination_label" character varying NOT NULL DEFAULT '', "order_subtotal_minor" bigint NOT NULL, "fee_minor" bigint NOT NULL, "threshold_applied_minor" bigint NULL, "currency" character varying NOT NULL, PRIMARY KEY ("id"));
-- create index "shippingcalculation_order_group_id" to table: "shipping_calculations"
CREATE UNIQUE INDEX "shippingcalculation_order_group_id" ON "shipping_calculations" ("order_group_id");
-- create "shipping_destinations" table
CREATE TABLE "shipping_destinations" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "zone_id" uuid NOT NULL, "country_code" character varying NOT NULL, "region_id" uuid NULL, "admin_area_id" uuid NULL, PRIMARY KEY ("id"));
-- create index "shippingdestination_country_code_region_id_admin_area_id" to table: "shipping_destinations"
CREATE INDEX "shippingdestination_country_code_region_id_admin_area_id" ON "shipping_destinations" ("country_code", "region_id", "admin_area_id");
-- create index "shippingdestination_zone_id" to table: "shipping_destinations"
CREATE INDEX "shippingdestination_zone_id" ON "shipping_destinations" ("zone_id");
-- create "shipping_profiles" table
CREATE TABLE "shipping_profiles" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "name" character varying NOT NULL, "currency" character varying NOT NULL, "is_default" boolean NOT NULL DEFAULT false, "active" boolean NOT NULL DEFAULT true, "free_shipping_threshold_minor" bigint NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "shippingprofile_store_id_is_default" to table: "shipping_profiles"
CREATE INDEX "shippingprofile_store_id_is_default" ON "shipping_profiles" ("store_id", "is_default");
-- create index "shippingprofile_store_id_name" to table: "shipping_profiles"
CREATE UNIQUE INDEX "shippingprofile_store_id_name" ON "shipping_profiles" ("store_id", "name");
-- create "shipping_rules" table
CREATE TABLE "shipping_rules" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "zone_id" uuid NOT NULL, "fee_minor" bigint NOT NULL DEFAULT 0, "is_free" boolean NOT NULL DEFAULT false, "free_threshold_minor" bigint NULL, "active" boolean NOT NULL DEFAULT true, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "shippingrule_zone_id" to table: "shipping_rules"
CREATE UNIQUE INDEX "shippingrule_zone_id" ON "shipping_rules" ("zone_id");
-- create "shipping_zones" table
CREATE TABLE "shipping_zones" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "profile_id" uuid NOT NULL, "name" character varying NOT NULL, "active" boolean NOT NULL DEFAULT true, PRIMARY KEY ("id"));
-- create index "shippingzone_profile_id_id" to table: "shipping_zones"
CREATE INDEX "shippingzone_profile_id_id" ON "shipping_zones" ("profile_id", "id");
-- create "store_credit_entries" table
CREATE TABLE "store_credit_entries" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "buyer_account_id" uuid NOT NULL, "order_group_id" uuid NULL, "kind" character varying NOT NULL, "amount_minor" bigint NOT NULL, "currency" character varying NOT NULL, "expires_at" timestamptz NULL, "dedupe_key" character varying NOT NULL, PRIMARY KEY ("id"));
-- create index "store_credit_entries_dedupe_key_key" to table: "store_credit_entries"
CREATE UNIQUE INDEX "store_credit_entries_dedupe_key_key" ON "store_credit_entries" ("dedupe_key");
-- create index "storecredit_expiring" to table: "store_credit_entries"
CREATE INDEX "storecredit_expiring" ON "store_credit_entries" ("expires_at") WHERE (((kind)::text = 'earn'::text) OR ((kind)::text = 'restore'::text));
-- create index "storecreditentry_buyer_account_id_id" to table: "store_credit_entries"
CREATE INDEX "storecreditentry_buyer_account_id_id" ON "store_credit_entries" ("buyer_account_id", "id");
-- create index "storecreditentry_store_id_buyer_account_id_id" to table: "store_credit_entries"
CREATE INDEX "storecreditentry_store_id_buyer_account_id_id" ON "store_credit_entries" ("store_id", "buyer_account_id", "id");
-- create index "storecreditentry_store_id_kind_created_at" to table: "store_credit_entries"
CREATE INDEX "storecreditentry_store_id_kind_created_at" ON "store_credit_entries" ("store_id", "kind", "created_at");
-- create "store_reward_settings" table
CREATE TABLE "store_reward_settings" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "enabled" boolean NOT NULL DEFAULT false, "percent_back_basis_points" bigint NOT NULL DEFAULT 0, "minimum_order_minor" bigint NOT NULL DEFAULT 0, "max_per_order_minor" bigint NOT NULL DEFAULT 0, "expiry_days" bigint NOT NULL DEFAULT 180, "currency" character varying NOT NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "storerewardsettings_store_id" to table: "store_reward_settings"
CREATE UNIQUE INDEX "storerewardsettings_store_id" ON "store_reward_settings" ("store_id");
