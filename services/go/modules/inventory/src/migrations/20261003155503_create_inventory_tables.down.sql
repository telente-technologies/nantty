-- reverse: create index "supplier_store_id_id" to table: "suppliers"
DROP INDEX "supplier_store_id_id";
-- reverse: create "suppliers" table
DROP TABLE "suppliers";
-- reverse: create index "stocktransferline_transfer_id_variant_id" to table: "stock_transfer_lines"
DROP INDEX "stocktransferline_transfer_id_variant_id";
-- reverse: create "stock_transfer_lines" table
DROP TABLE "stock_transfer_lines";
-- reverse: create index "stocktransfer_store_id_status_id" to table: "stock_transfers"
DROP INDEX "stocktransfer_store_id_status_id";
-- reverse: create index "stocktransfer_store_id_reference" to table: "stock_transfers"
DROP INDEX "stocktransfer_store_id_reference";
-- reverse: create "stock_transfers" table
DROP TABLE "stock_transfers";
-- reverse: create index "stockreservation_store_id_status" to table: "stock_reservations"
DROP INDEX "stockreservation_store_id_status";
-- reverse: create index "stockreservation_reference_variant_id_location_id" to table: "stock_reservations"
DROP INDEX "stockreservation_reference_variant_id_location_id";
-- reverse: create index "stockreservation_active_expiry" to table: "stock_reservations"
DROP INDEX "stockreservation_active_expiry";
-- reverse: create "stock_reservations" table
DROP TABLE "stock_reservations";
-- reverse: create index "stockmovement_variant_id_id" to table: "stock_movements"
DROP INDEX "stockmovement_variant_id_id";
-- reverse: create index "stockmovement_store_id_location_id_id" to table: "stock_movements"
DROP INDEX "stockmovement_store_id_location_id_id";
-- reverse: create index "stockmovement_store_id_kind_id" to table: "stock_movements"
DROP INDEX "stockmovement_store_id_kind_id";
-- reverse: create index "stockmovement_store_id_id" to table: "stock_movements"
DROP INDEX "stockmovement_store_id_id";
-- reverse: create index "stock_movements_dedupe_key_key" to table: "stock_movements"
DROP INDEX "stock_movements_dedupe_key_key";
-- reverse: create "stock_movements" table
DROP TABLE "stock_movements";
-- reverse: create index "stocklocation_store_id_name" to table: "stock_locations"
DROP INDEX "stocklocation_store_id_name";
-- reverse: create index "stocklocation_store_id_id" to table: "stock_locations"
DROP INDEX "stocklocation_store_id_id";
-- reverse: create index "stocklocation_store_default_unique" to table: "stock_locations"
DROP INDEX "stocklocation_store_default_unique";
-- reverse: create "stock_locations" table
DROP TABLE "stock_locations";
-- reverse: create index "stocklevel_variant_id_location_id" to table: "stock_levels"
DROP INDEX "stocklevel_variant_id_location_id";
-- reverse: create index "stocklevel_store_id_variant_id" to table: "stock_levels"
DROP INDEX "stocklevel_store_id_variant_id";
-- reverse: create index "stocklevel_store_id_location_id_id" to table: "stock_levels"
DROP INDEX "stocklevel_store_id_location_id_id";
-- reverse: create index "stocklevel_location_id" to table: "stock_levels"
DROP INDEX "stocklevel_location_id";
-- reverse: create "stock_levels" table
DROP TABLE "stock_levels";
-- reverse: create index "stockadjustment_store_id_reason_id" to table: "stock_adjustments"
DROP INDEX "stockadjustment_store_id_reason_id";
-- reverse: create index "stockadjustment_store_id_location_id_id" to table: "stock_adjustments"
DROP INDEX "stockadjustment_store_id_location_id_id";
-- reverse: create index "stockadjustment_store_id_id" to table: "stock_adjustments"
DROP INDEX "stockadjustment_store_id_id";
-- reverse: create index "stockadjustment_batch_id" to table: "stock_adjustments"
DROP INDEX "stockadjustment_batch_id";
-- reverse: create "stock_adjustments" table
DROP TABLE "stock_adjustments";
-- reverse: create index "outboxevent_published_at_created_at" to table: "outbox_events"
DROP INDEX "outboxevent_published_at_created_at";
-- reverse: create "outbox_events" table
DROP TABLE "outbox_events";
-- reverse: create index "idempotentrequest_scope_key" to table: "idempotent_requests"
DROP INDEX "idempotentrequest_scope_key";
-- reverse: create "idempotent_requests" table
DROP TABLE "idempotent_requests";
