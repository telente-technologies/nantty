-- create "delivery_attempts" table
CREATE TABLE "delivery_attempts" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "shipment_id" uuid NOT NULL, "attempt_number" bigint NOT NULL, "status" character varying NOT NULL DEFAULT 'failed', "failure_reason" character varying NOT NULL DEFAULT '', "responsible_party" character varying NOT NULL DEFAULT 'unassigned', "evidence" character varying NOT NULL DEFAULT '', "attempted_at" timestamptz NOT NULL, "metadata" jsonb NULL, PRIMARY KEY ("id"));
-- create index "deliveryattempt_shipment_id_attempt_number" to table: "delivery_attempts"
CREATE UNIQUE INDEX "deliveryattempt_shipment_id_attempt_number" ON "delivery_attempts" ("shipment_id", "attempt_number");
-- create "delivery_claims" table
CREATE TABLE "delivery_claims" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "shipment_id" uuid NOT NULL, "kind" character varying NOT NULL DEFAULT 'loss', "status" character varying NOT NULL DEFAULT 'open', "amount_minor" bigint NOT NULL, "currency" character varying NOT NULL, "responsible_party" character varying NOT NULL DEFAULT 'unassigned', "description" character varying NOT NULL DEFAULT '', "evidence" jsonb NULL, "resolution" character varying NOT NULL DEFAULT '', "opened_at" timestamptz NOT NULL, "resolved_at" timestamptz NULL, "metadata" jsonb NULL, PRIMARY KEY ("id"));
-- create index "deliveryclaim_shipment_id_id" to table: "delivery_claims"
CREATE INDEX "deliveryclaim_shipment_id_id" ON "delivery_claims" ("shipment_id", "id");
-- create index "deliveryclaim_status_opened_at" to table: "delivery_claims"
CREATE INDEX "deliveryclaim_status_opened_at" ON "delivery_claims" ("status", "opened_at");
-- create "delivery_policies" table
CREATE TABLE "delivery_policies" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "active" boolean NOT NULL DEFAULT true, "funding_party" character varying NOT NULL DEFAULT 'seller', "free_shipping_threshold_minor" bigint NULL, "seller_subsidy_cap_minor" bigint NULL, "eligible_category_ids" jsonb NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "deliverypolicy_store_id" to table: "delivery_policies"
CREATE UNIQUE INDEX "deliverypolicy_store_id" ON "delivery_policies" ("store_id");
-- create "delivery_quotes" table
CREATE TABLE "delivery_quotes" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "checkout_id" uuid NULL, "order_group_id" uuid NULL, "provider" character varying NOT NULL, "provider_quote_id" character varying NULL, "service_type" character varying NOT NULL DEFAULT 'door_to_door', "status" character varying NOT NULL DEFAULT 'quoted', "amount_minor" bigint NOT NULL, "currency" character varying NOT NULL, "route" jsonb NOT NULL, "expires_at" timestamptz NOT NULL, "conditions" jsonb NULL, "metadata" jsonb NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "deliveryquote_checkout_id" to table: "delivery_quotes"
CREATE INDEX "deliveryquote_checkout_id" ON "delivery_quotes" ("checkout_id");
-- create index "deliveryquote_order_group_id" to table: "delivery_quotes"
CREATE INDEX "deliveryquote_order_group_id" ON "delivery_quotes" ("order_group_id");
-- create index "deliveryquote_provider_quote_unique" to table: "delivery_quotes"
CREATE UNIQUE INDEX "deliveryquote_provider_quote_unique" ON "delivery_quotes" ("provider", "provider_quote_id") WHERE (provider_quote_id IS NOT NULL);
-- create index "deliveryquote_store_id_status_expires_at" to table: "delivery_quotes"
CREATE INDEX "deliveryquote_store_id_status_expires_at" ON "delivery_quotes" ("store_id", "status", "expires_at");
-- create "parcels" table
CREATE TABLE "parcels" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "shipment_id" uuid NOT NULL, "weight_grams" bigint NOT NULL, "length_mm" bigint NOT NULL, "width_mm" bigint NOT NULL, "height_mm" bigint NOT NULL, "package_category" character varying NOT NULL DEFAULT 'general', "package_count" bigint NOT NULL DEFAULT 1, "fragile" boolean NOT NULL DEFAULT false, "contents_description" character varying NOT NULL DEFAULT '', "declared_value_minor" bigint NOT NULL, "currency" character varying NOT NULL, "metadata" jsonb NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "parcel_shipment_id" to table: "parcels"
CREATE UNIQUE INDEX "parcel_shipment_id" ON "parcels" ("shipment_id");
-- create "shipments" table
CREATE TABLE "shipments" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "order_group_id" uuid NOT NULL, "store_id" uuid NOT NULL, "provider" character varying NOT NULL, "provider_reference" character varying NULL, "quote_id" uuid NULL, "status" character varying NOT NULL DEFAULT 'pending', "previous_status" character varying NOT NULL DEFAULT '', "service_type" character varying NOT NULL DEFAULT 'door_to_door', "pickup_address" jsonb NOT NULL, "destination_address" jsonb NOT NULL, "tracking_number" character varying NULL, "tracking_url" character varying NULL, "delivery_pin_hash" character varying NULL, "booked_at" timestamptz NULL, "ready_for_pickup_at" timestamptz NULL, "picked_up_at" timestamptz NULL, "delivered_at" timestamptz NULL, "cancelled_at" timestamptz NULL, "estimated_delivery_at" timestamptz NULL, "cancellation_reason" character varying NULL, "metadata" jsonb NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "shipment_order_group_id" to table: "shipments"
CREATE UNIQUE INDEX "shipment_order_group_id" ON "shipments" ("order_group_id");
-- create index "shipment_provider_reference_unique" to table: "shipments"
CREATE UNIQUE INDEX "shipment_provider_reference_unique" ON "shipments" ("provider", "provider_reference") WHERE (provider_reference IS NOT NULL);
-- create index "shipment_status_updated_at" to table: "shipments"
CREATE INDEX "shipment_status_updated_at" ON "shipments" ("status", "updated_at");
-- create index "shipment_store_status_newest" to table: "shipments"
CREATE INDEX "shipment_store_status_newest" ON "shipments" ("store_id", "status", "id" DESC);
-- create "shipment_charges" table
CREATE TABLE "shipment_charges" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "shipment_id" uuid NOT NULL, "kind" character varying NOT NULL, "funding_party" character varying NOT NULL DEFAULT 'unassigned', "amount_minor" bigint NOT NULL, "currency" character varying NOT NULL, "reference" character varying NULL, "metadata" jsonb NULL, PRIMARY KEY ("id"));
-- create index "shipmentcharge_shipment_id_kind" to table: "shipment_charges"
CREATE INDEX "shipmentcharge_shipment_id_kind" ON "shipment_charges" ("shipment_id", "kind");
-- create "shipment_events" table
CREATE TABLE "shipment_events" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "shipment_id" uuid NOT NULL, "provider" character varying NOT NULL, "provider_event_id" character varying NULL, "kind" character varying NOT NULL, "status" character varying NOT NULL, "source" character varying NOT NULL DEFAULT 'webhook', "payload" jsonb NULL, "occurred_at" timestamptz NOT NULL, "received_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "shipevent_provider_event_unique" to table: "shipment_events"
CREATE UNIQUE INDEX "shipevent_provider_event_unique" ON "shipment_events" ("provider", "provider_event_id") WHERE (provider_event_id IS NOT NULL);
-- create index "shipmentevent_shipment_id_occurred_at" to table: "shipment_events"
CREATE INDEX "shipmentevent_shipment_id_occurred_at" ON "shipment_events" ("shipment_id", "occurred_at");
-- create "shipment_insurances" table
CREATE TABLE "shipment_insurances" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "shipment_id" uuid NOT NULL, "provider" character varying NOT NULL, "insurer" character varying NOT NULL DEFAULT '', "policy_reference" character varying NULL, "coverage_amount_minor" bigint NOT NULL, "premium_minor" bigint NOT NULL, "currency" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "exclusions" jsonb NULL, "metadata" jsonb NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "shipmentinsurance_shipment_id" to table: "shipment_insurances"
CREATE UNIQUE INDEX "shipmentinsurance_shipment_id" ON "shipment_insurances" ("shipment_id");
-- create index "shipmentinsurance_status_updated_at" to table: "shipment_insurances"
CREATE INDEX "shipmentinsurance_status_updated_at" ON "shipment_insurances" ("status", "updated_at");
