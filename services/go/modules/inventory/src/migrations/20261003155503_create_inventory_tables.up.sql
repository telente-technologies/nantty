-- create "idempotent_requests" table
CREATE TABLE "idempotent_requests" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "scope" character varying NOT NULL, "key" character varying NOT NULL, "request_hash" character varying NOT NULL, "response_body" jsonb NULL, PRIMARY KEY ("id"));
-- create index "idempotentrequest_scope_key" to table: "idempotent_requests"
CREATE UNIQUE INDEX "idempotentrequest_scope_key" ON "idempotent_requests" ("scope", "key");
-- create "outbox_events" table
CREATE TABLE "outbox_events" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "event_type" character varying NOT NULL, "subject" character varying NOT NULL, "payload" jsonb NOT NULL, "published_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "outboxevent_published_at_created_at" to table: "outbox_events"
CREATE INDEX "outboxevent_published_at_created_at" ON "outbox_events" ("published_at", "created_at");
-- create "stock_adjustments" table
CREATE TABLE "stock_adjustments" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "location_id" uuid NOT NULL, "variant_id" uuid NOT NULL, "batch_id" uuid NOT NULL, "reason" character varying NOT NULL, "note" character varying NOT NULL DEFAULT '', "quantity_delta" bigint NOT NULL, "quantity_before" bigint NOT NULL, "quantity_after" bigint NOT NULL, "actor_account_id" uuid NOT NULL, "actor_name" character varying NOT NULL DEFAULT '', PRIMARY KEY ("id"));
-- create index "stockadjustment_batch_id" to table: "stock_adjustments"
CREATE INDEX "stockadjustment_batch_id" ON "stock_adjustments" ("batch_id");
-- create index "stockadjustment_store_id_id" to table: "stock_adjustments"
CREATE INDEX "stockadjustment_store_id_id" ON "stock_adjustments" ("store_id", "id");
-- create index "stockadjustment_store_id_location_id_id" to table: "stock_adjustments"
CREATE INDEX "stockadjustment_store_id_location_id_id" ON "stock_adjustments" ("store_id", "location_id", "id");
-- create index "stockadjustment_store_id_reason_id" to table: "stock_adjustments"
CREATE INDEX "stockadjustment_store_id_reason_id" ON "stock_adjustments" ("store_id", "reason", "id");
-- create "stock_levels" table
CREATE TABLE "stock_levels" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "product_id" uuid NOT NULL, "variant_id" uuid NOT NULL, "location_id" uuid NOT NULL, "on_hand" bigint NOT NULL DEFAULT 0, "reserved" bigint NOT NULL DEFAULT 0, "low_stock_level" bigint NOT NULL DEFAULT 5, "reorder_point" bigint NOT NULL DEFAULT 5, "reorder_quantity" bigint NOT NULL DEFAULT 10, "listed" boolean NOT NULL DEFAULT true, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "stock_level_on_hand_not_negative" CHECK (on_hand >= 0), CONSTRAINT "stock_level_reserved_not_negative" CHECK (reserved >= 0));
-- create index "stocklevel_location_id" to table: "stock_levels"
CREATE INDEX "stocklevel_location_id" ON "stock_levels" ("location_id");
-- create index "stocklevel_store_id_location_id_id" to table: "stock_levels"
CREATE INDEX "stocklevel_store_id_location_id_id" ON "stock_levels" ("store_id", "location_id", "id");
-- create index "stocklevel_store_id_variant_id" to table: "stock_levels"
CREATE INDEX "stocklevel_store_id_variant_id" ON "stock_levels" ("store_id", "variant_id");
-- create index "stocklevel_variant_id_location_id" to table: "stock_levels"
CREATE UNIQUE INDEX "stocklevel_variant_id_location_id" ON "stock_levels" ("variant_id", "location_id");
-- create "stock_locations" table
CREATE TABLE "stock_locations" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "name" character varying NOT NULL, "kind" character varying NOT NULL DEFAULT 'warehouse', "address" character varying NOT NULL DEFAULT '', "city" character varying NOT NULL DEFAULT '', "state" character varying NOT NULL DEFAULT '', "country_code" character varying NOT NULL DEFAULT '', "phone" character varying NULL, "is_default" boolean NOT NULL DEFAULT false, "active" boolean NOT NULL DEFAULT true, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "stocklocation_store_default_unique" to table: "stock_locations"
CREATE UNIQUE INDEX "stocklocation_store_default_unique" ON "stock_locations" ("store_id") WHERE is_default;
-- create index "stocklocation_store_id_id" to table: "stock_locations"
CREATE INDEX "stocklocation_store_id_id" ON "stock_locations" ("store_id", "id");
-- create index "stocklocation_store_id_name" to table: "stock_locations"
CREATE UNIQUE INDEX "stocklocation_store_id_name" ON "stock_locations" ("store_id", "name");
-- create "stock_movements" table
CREATE TABLE "stock_movements" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "variant_id" uuid NOT NULL, "location_id" uuid NOT NULL, "kind" character varying NOT NULL, "on_hand_delta" bigint NOT NULL, "reserved_delta" bigint NOT NULL DEFAULT 0, "reference" character varying NOT NULL DEFAULT '', "reason" character varying NOT NULL DEFAULT '', "note" character varying NOT NULL DEFAULT '', "actor_account_id" uuid NULL, "actor_name" character varying NOT NULL DEFAULT '', "dedupe_key" character varying NULL, PRIMARY KEY ("id"));
-- create index "stock_movements_dedupe_key_key" to table: "stock_movements"
CREATE UNIQUE INDEX "stock_movements_dedupe_key_key" ON "stock_movements" ("dedupe_key");
-- create index "stockmovement_store_id_id" to table: "stock_movements"
CREATE INDEX "stockmovement_store_id_id" ON "stock_movements" ("store_id", "id");
-- create index "stockmovement_store_id_kind_id" to table: "stock_movements"
CREATE INDEX "stockmovement_store_id_kind_id" ON "stock_movements" ("store_id", "kind", "id");
-- create index "stockmovement_store_id_location_id_id" to table: "stock_movements"
CREATE INDEX "stockmovement_store_id_location_id_id" ON "stock_movements" ("store_id", "location_id", "id");
-- create index "stockmovement_variant_id_id" to table: "stock_movements"
CREATE INDEX "stockmovement_variant_id_id" ON "stock_movements" ("variant_id", "id");
-- create "stock_reservations" table
CREATE TABLE "stock_reservations" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "reference" character varying NOT NULL, "store_id" uuid NOT NULL, "variant_id" uuid NOT NULL, "location_id" uuid NOT NULL, "quantity" bigint NOT NULL, "status" character varying NOT NULL DEFAULT 'active', "expires_at" timestamptz NULL, "settled_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "stockreservation_active_expiry" to table: "stock_reservations"
CREATE INDEX "stockreservation_active_expiry" ON "stock_reservations" ("expires_at") WHERE ((status)::text = 'active'::text);
-- create index "stockreservation_reference_variant_id_location_id" to table: "stock_reservations"
CREATE UNIQUE INDEX "stockreservation_reference_variant_id_location_id" ON "stock_reservations" ("reference", "variant_id", "location_id");
-- create index "stockreservation_store_id_status" to table: "stock_reservations"
CREATE INDEX "stockreservation_store_id_status" ON "stock_reservations" ("store_id", "status");
-- create "stock_transfers" table
CREATE TABLE "stock_transfers" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "reference" character varying NOT NULL, "from_location_id" uuid NOT NULL, "to_location_id" uuid NOT NULL, "status" character varying NOT NULL DEFAULT 'in_transit', "note" character varying NOT NULL DEFAULT '', "created_by_account_id" uuid NOT NULL, "received_at" timestamptz NULL, "cancelled_at" timestamptz NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "stocktransfer_store_id_reference" to table: "stock_transfers"
CREATE UNIQUE INDEX "stocktransfer_store_id_reference" ON "stock_transfers" ("store_id", "reference");
-- create index "stocktransfer_store_id_status_id" to table: "stock_transfers"
CREATE INDEX "stocktransfer_store_id_status_id" ON "stock_transfers" ("store_id", "status", "id");
-- create "stock_transfer_lines" table
CREATE TABLE "stock_transfer_lines" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "transfer_id" uuid NOT NULL, "variant_id" uuid NOT NULL, "quantity" bigint NOT NULL, PRIMARY KEY ("id"));
-- create index "stocktransferline_transfer_id_variant_id" to table: "stock_transfer_lines"
CREATE UNIQUE INDEX "stocktransferline_transfer_id_variant_id" ON "stock_transfer_lines" ("transfer_id", "variant_id");
-- create "suppliers" table
CREATE TABLE "suppliers" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "name" character varying NOT NULL, "contact_name" character varying NOT NULL DEFAULT '', "phone" character varying NOT NULL DEFAULT '', "email" character varying NULL, "address" character varying NOT NULL DEFAULT '', "lead_time_days" bigint NOT NULL DEFAULT 0, "payment_terms" character varying NOT NULL DEFAULT '', "notes" character varying NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "supplier_store_id_id" to table: "suppliers"
CREATE INDEX "supplier_store_id_id" ON "suppliers" ("store_id", "id");
