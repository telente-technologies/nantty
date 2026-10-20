-- reverse: create index "shipmentinsurance_status_updated_at" to table: "shipment_insurances"
DROP INDEX "shipmentinsurance_status_updated_at";
-- reverse: create index "shipmentinsurance_shipment_id" to table: "shipment_insurances"
DROP INDEX "shipmentinsurance_shipment_id";
-- reverse: create "shipment_insurances" table
DROP TABLE "shipment_insurances";
-- reverse: create index "shipmentevent_shipment_id_occurred_at" to table: "shipment_events"
DROP INDEX "shipmentevent_shipment_id_occurred_at";
-- reverse: create index "shipevent_provider_event_unique" to table: "shipment_events"
DROP INDEX "shipevent_provider_event_unique";
-- reverse: create "shipment_events" table
DROP TABLE "shipment_events";
-- reverse: create index "shipmentcharge_shipment_id_kind" to table: "shipment_charges"
DROP INDEX "shipmentcharge_shipment_id_kind";
-- reverse: create "shipment_charges" table
DROP TABLE "shipment_charges";
-- reverse: create index "shipment_store_status_newest" to table: "shipments"
DROP INDEX "shipment_store_status_newest";
-- reverse: create index "shipment_status_updated_at" to table: "shipments"
DROP INDEX "shipment_status_updated_at";
-- reverse: create index "shipment_provider_reference_unique" to table: "shipments"
DROP INDEX "shipment_provider_reference_unique";
-- reverse: create index "shipment_order_group_id" to table: "shipments"
DROP INDEX "shipment_order_group_id";
-- reverse: create "shipments" table
DROP TABLE "shipments";
-- reverse: create index "parcel_shipment_id" to table: "parcels"
DROP INDEX "parcel_shipment_id";
-- reverse: create "parcels" table
DROP TABLE "parcels";
-- reverse: create index "deliveryquote_store_id_status_expires_at" to table: "delivery_quotes"
DROP INDEX "deliveryquote_store_id_status_expires_at";
-- reverse: create index "deliveryquote_provider_quote_unique" to table: "delivery_quotes"
DROP INDEX "deliveryquote_provider_quote_unique";
-- reverse: create index "deliveryquote_order_group_id" to table: "delivery_quotes"
DROP INDEX "deliveryquote_order_group_id";
-- reverse: create "delivery_quotes" table
DROP TABLE "delivery_quotes";
-- reverse: create index "deliverypolicy_store_id" to table: "delivery_policies"
DROP INDEX "deliverypolicy_store_id";
-- reverse: create "delivery_policies" table
DROP TABLE "delivery_policies";
-- reverse: create index "deliveryclaim_status_opened_at" to table: "delivery_claims"
DROP INDEX "deliveryclaim_status_opened_at";
-- reverse: create index "deliveryclaim_shipment_id_id" to table: "delivery_claims"
DROP INDEX "deliveryclaim_shipment_id_id";
-- reverse: create "delivery_claims" table
DROP TABLE "delivery_claims";
-- reverse: create index "deliveryattempt_shipment_id_attempt_number" to table: "delivery_attempts"
DROP INDEX "deliveryattempt_shipment_id_attempt_number";
-- reverse: create "delivery_attempts" table
DROP TABLE "delivery_attempts";
