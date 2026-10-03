-- reverse: create index "dispute_status_created_at" to table: "disputes"
DROP INDEX "dispute_status_created_at";
-- reverse: create index "dispute_order_id" to table: "disputes"
DROP INDEX "dispute_order_id";
-- reverse: create index "dispute_opened_by_user_id_created_at" to table: "disputes"
DROP INDEX "dispute_opened_by_user_id_created_at";
-- reverse: create index "dispute_escrow_id" to table: "disputes"
DROP INDEX "dispute_escrow_id";
-- reverse: create "disputes" table
DROP TABLE "disputes";
-- reverse: create index "outboxevent_published_at_dead_lettered_at_created_at" to table: "outbox_events"
DROP INDEX "outboxevent_published_at_dead_lettered_at_created_at";
-- reverse: create "outbox_events" table
DROP TABLE "outbox_events";
-- reverse: create index "idempotentrequest_scope_key" to table: "idempotent_requests"
DROP INDEX "idempotentrequest_scope_key";
-- reverse: create "idempotent_requests" table
DROP TABLE "idempotent_requests";
-- reverse: create index "escrowevent_escrow_id_created_at" to table: "escrow_events"
DROP INDEX "escrowevent_escrow_id_created_at";
-- reverse: create "escrow_events" table
DROP TABLE "escrow_events";
-- reverse: create index "escrow_status_auto_release_at" to table: "escrows"
DROP INDEX "escrow_status_auto_release_at";
-- reverse: create index "escrow_seller_user_id_status" to table: "escrows"
DROP INDEX "escrow_seller_user_id_status";
-- reverse: create index "escrow_order_id" to table: "escrows"
DROP INDEX "escrow_order_id";
-- reverse: create index "escrow_checkout_id" to table: "escrows"
DROP INDEX "escrow_checkout_id";
-- reverse: create index "escrow_buyer_user_id_created_at" to table: "escrows"
DROP INDEX "escrow_buyer_user_id_created_at";
-- reverse: create "escrows" table
DROP TABLE "escrows";
-- reverse: create index "disputestatusevent_dispute_id_created_at" to table: "dispute_status_events"
DROP INDEX "disputestatusevent_dispute_id_created_at";
-- reverse: create "dispute_status_events" table
DROP TABLE "dispute_status_events";
-- reverse: create index "disputemessage_dispute_id_created_at" to table: "dispute_messages"
DROP INDEX "disputemessage_dispute_id_created_at";
-- reverse: create "dispute_messages" table
DROP TABLE "dispute_messages";
