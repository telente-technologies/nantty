-- drop index "stockreservation_reference_variant_id_location_id" from table: "stock_reservations"
DROP INDEX "stockreservation_reference_variant_id_location_id";
-- modify "stock_reservations" table
ALTER TABLE "stock_reservations" ADD COLUMN "attempt" bigint NOT NULL DEFAULT 0;
-- create index "stockreservation_reference_variant_id_location_id_attempt" to table: "stock_reservations"
CREATE UNIQUE INDEX "stockreservation_reference_variant_id_location_id_attempt" ON "stock_reservations" ("reference", "variant_id", "location_id", "attempt");
