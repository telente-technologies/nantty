-- reverse: create index "storerewardsettings_store_id" to table: "store_reward_settings"
DROP INDEX "storerewardsettings_store_id";
-- reverse: create "store_reward_settings" table
DROP TABLE "store_reward_settings";
-- reverse: create index "storecreditentry_store_id_kind_created_at" to table: "store_credit_entries"
DROP INDEX "storecreditentry_store_id_kind_created_at";
-- reverse: create index "storecreditentry_store_id_buyer_account_id_id" to table: "store_credit_entries"
DROP INDEX "storecreditentry_store_id_buyer_account_id_id";
-- reverse: create index "storecreditentry_buyer_account_id_id" to table: "store_credit_entries"
DROP INDEX "storecreditentry_buyer_account_id_id";
-- reverse: create index "storecredit_expiring" to table: "store_credit_entries"
DROP INDEX "storecredit_expiring";
-- reverse: create index "store_credit_entries_dedupe_key_key" to table: "store_credit_entries"
DROP INDEX "store_credit_entries_dedupe_key_key";
-- reverse: create "store_credit_entries" table
DROP TABLE "store_credit_entries";
-- reverse: create index "shippingzone_profile_id_id" to table: "shipping_zones"
DROP INDEX "shippingzone_profile_id_id";
-- reverse: create "shipping_zones" table
DROP TABLE "shipping_zones";
-- reverse: create index "shippingrule_zone_id" to table: "shipping_rules"
DROP INDEX "shippingrule_zone_id";
-- reverse: create "shipping_rules" table
DROP TABLE "shipping_rules";
-- reverse: create index "shippingprofile_store_id_name" to table: "shipping_profiles"
DROP INDEX "shippingprofile_store_id_name";
-- reverse: create index "shippingprofile_store_id_is_default" to table: "shipping_profiles"
DROP INDEX "shippingprofile_store_id_is_default";
-- reverse: create "shipping_profiles" table
DROP TABLE "shipping_profiles";
-- reverse: create index "shippingdestination_zone_id" to table: "shipping_destinations"
DROP INDEX "shippingdestination_zone_id";
-- reverse: create index "shippingdestination_country_code_region_id_admin_area_id" to table: "shipping_destinations"
DROP INDEX "shippingdestination_country_code_region_id_admin_area_id";
-- reverse: create "shipping_destinations" table
DROP TABLE "shipping_destinations";
-- reverse: create index "shippingcalculation_order_group_id" to table: "shipping_calculations"
DROP INDEX "shippingcalculation_order_group_id";
-- reverse: create "shipping_calculations" table
DROP TABLE "shipping_calculations";
-- reverse: create index "returnrequest_store_status_newest" to table: "return_requests"
DROP INDEX "returnrequest_store_status_newest";
-- reverse: create index "returnrequest_order_group_id_status" to table: "return_requests"
DROP INDEX "returnrequest_order_group_id_status";
-- reverse: create index "returnrequest_buyer_newest" to table: "return_requests"
DROP INDEX "returnrequest_buyer_newest";
-- reverse: create "return_requests" table
DROP TABLE "return_requests";
-- reverse: create index "reportexportjob_store_id_id" to table: "report_export_jobs"
DROP INDEX "reportexportjob_store_id_id";
-- reverse: create index "reportexport_queued" to table: "report_export_jobs"
DROP INDEX "reportexport_queued";
-- reverse: create "report_export_jobs" table
DROP TABLE "report_export_jobs";
-- reverse: create index "promotionredemption_promotion_id_buyer_account_id" to table: "promotion_redemptions"
DROP INDEX "promotionredemption_promotion_id_buyer_account_id";
-- reverse: create index "promotionredemption_order_group_id" to table: "promotion_redemptions"
DROP INDEX "promotionredemption_order_group_id";
-- reverse: create "promotion_redemptions" table
DROP TABLE "promotion_redemptions";
-- reverse: create index "promotion_store_id_kind_starts_at" to table: "promotions"
DROP INDEX "promotion_store_id_kind_starts_at";
-- reverse: create index "promotion_store_id_id" to table: "promotions"
DROP INDEX "promotion_store_id_id";
-- reverse: create index "promotion_store_code_unique" to table: "promotions"
DROP INDEX "promotion_store_code_unique";
-- reverse: create "promotions" table
DROP TABLE "promotions";
-- reverse: create index "processedevent_envelope_id" to table: "processed_events"
DROP INDEX "processedevent_envelope_id";
-- reverse: create "processed_events" table
DROP TABLE "processed_events";
-- reverse: create index "outboxevent_published_at_created_at" to table: "outbox_events"
DROP INDEX "outboxevent_published_at_created_at";
-- reverse: create "outbox_events" table
DROP TABLE "outbox_events";
-- reverse: create index "ordernote_order_group_id_id" to table: "order_notes"
DROP INDEX "ordernote_order_group_id_id";
-- reverse: create "order_notes" table
DROP TABLE "order_notes";
-- reverse: create index "orderitem_store_id_product_id" to table: "order_items"
DROP INDEX "orderitem_store_id_product_id";
-- reverse: create index "orderitem_product_id" to table: "order_items"
DROP INDEX "orderitem_product_id";
-- reverse: create index "orderitem_order_group_id" to table: "order_items"
DROP INDEX "orderitem_order_group_id";
-- reverse: create "order_items" table
DROP TABLE "order_items";
-- reverse: create index "ordergroup_store_status_newest" to table: "order_groups"
DROP INDEX "ordergroup_store_status_newest";
-- reverse: create index "ordergroup_store_id_invoice_number" to table: "order_groups"
DROP INDEX "ordergroup_store_id_invoice_number";
-- reverse: create index "ordergroup_store_id_buyer_account_id" to table: "order_groups"
DROP INDEX "ordergroup_store_id_buyer_account_id";
-- reverse: create index "ordergroup_reference" to table: "order_groups"
DROP INDEX "ordergroup_reference";
-- reverse: create index "ordergroup_delivered_release" to table: "order_groups"
DROP INDEX "ordergroup_delivered_release";
-- reverse: create index "ordergroup_checkout_id" to table: "order_groups"
DROP INDEX "ordergroup_checkout_id";
-- reverse: create index "ordergroup_buyer_status_newest" to table: "order_groups"
DROP INDEX "ordergroup_buyer_status_newest";
-- reverse: create index "ordergroup_buyer_newest" to table: "order_groups"
DROP INDEX "ordergroup_buyer_newest";
-- reverse: create "order_groups" table
DROP TABLE "order_groups";
-- reverse: create index "orderevent_order_group_id_id" to table: "order_events"
DROP INDEX "orderevent_order_group_id_id";
-- reverse: create "order_events" table
DROP TABLE "order_events";
-- reverse: create index "idempotentrequest_scope_key" to table: "idempotent_requests"
DROP INDEX "idempotentrequest_scope_key";
-- reverse: create "idempotent_requests" table
DROP TABLE "idempotent_requests";
-- reverse: create index "customernote_store_id_buyer_account_id_id" to table: "customer_notes"
DROP INDEX "customernote_store_id_buyer_account_id_id";
-- reverse: create "customer_notes" table
DROP TABLE "customer_notes";
-- reverse: create index "checkout_open_expiry" to table: "checkouts"
DROP INDEX "checkout_open_expiry";
-- reverse: create index "checkout_buyer_account_id_idempotency_key" to table: "checkouts"
DROP INDEX "checkout_buyer_account_id_idempotency_key";
-- reverse: create "checkouts" table
DROP TABLE "checkouts";
-- reverse: create index "cartitem_variant_id" to table: "cart_items"
DROP INDEX "cartitem_variant_id";
-- reverse: create index "cartitem_cart_id_variant_id" to table: "cart_items"
DROP INDEX "cartitem_cart_id_variant_id";
-- reverse: create "cart_items" table
DROP TABLE "cart_items";
-- reverse: create index "cart_account_id" to table: "carts"
DROP INDEX "cart_account_id";
-- reverse: create "carts" table
DROP TABLE "carts";
