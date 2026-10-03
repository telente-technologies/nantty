-- reverse: create index "webhookevent_provider_event_key" to table: "webhook_events"
DROP INDEX "webhookevent_provider_event_key";
-- reverse: create index "webhookevent_processed_at_created_at" to table: "webhook_events"
DROP INDEX "webhookevent_processed_at_created_at";
-- reverse: create "webhook_events" table
DROP TABLE "webhook_events";
-- reverse: create index "storepurchase_user_id_created_at" to table: "store_purchases"
DROP INDEX "storepurchase_user_id_created_at";
-- reverse: create index "storepurchase_store_store_transaction_id" to table: "store_purchases"
DROP INDEX "storepurchase_store_store_transaction_id";
-- reverse: create "store_purchases" table
DROP TABLE "store_purchases";
-- reverse: create index "payouttransfer_status_created_at" to table: "payout_transfers"
DROP INDEX "payouttransfer_status_created_at";
-- reverse: create index "payouttransfer_reference" to table: "payout_transfers"
DROP INDEX "payouttransfer_reference";
-- reverse: create index "payouttransfer_purpose_subject_id" to table: "payout_transfers"
DROP INDEX "payouttransfer_purpose_subject_id";
-- reverse: create "payout_transfers" table
DROP TABLE "payout_transfers";
-- reverse: create index "paymentrefund_status_created_at" to table: "payment_refunds"
DROP INDEX "paymentrefund_status_created_at";
-- reverse: create index "paymentrefund_reference" to table: "payment_refunds"
DROP INDEX "paymentrefund_reference";
-- reverse: create index "paymentrefund_payment_intent_id" to table: "payment_refunds"
DROP INDEX "paymentrefund_payment_intent_id";
-- reverse: create "payment_refunds" table
DROP TABLE "payment_refunds";
-- reverse: create index "paymentintent_status_created_at" to table: "payment_intents"
DROP INDEX "paymentintent_status_created_at";
-- reverse: create index "paymentintent_reference" to table: "payment_intents"
DROP INDEX "paymentintent_reference";
-- reverse: create index "paymentintent_purpose_subject_id" to table: "payment_intents"
DROP INDEX "paymentintent_purpose_subject_id";
-- reverse: create index "paymentintent_owner_user_id_created_at" to table: "payment_intents"
DROP INDEX "paymentintent_owner_user_id_created_at";
-- reverse: create "payment_intents" table
DROP TABLE "payment_intents";
-- reverse: create index "outboxevent_published_at_dead_lettered_at_created_at" to table: "outbox_events"
DROP INDEX "outboxevent_published_at_dead_lettered_at_created_at";
-- reverse: create "outbox_events" table
DROP TABLE "outbox_events";
-- reverse: create index "orderpayable_order_id" to table: "order_payables"
DROP INDEX "orderpayable_order_id";
-- reverse: create index "orderpayable_checkout_id" to table: "order_payables"
DROP INDEX "orderpayable_checkout_id";
-- reverse: create "order_payables" table
DROP TABLE "order_payables";
-- reverse: create index "idempotentrequest_scope_key" to table: "idempotent_requests"
DROP INDEX "idempotentrequest_scope_key";
-- reverse: create "idempotent_requests" table
DROP TABLE "idempotent_requests";
