-- create "idempotent_requests" table
CREATE TABLE "idempotent_requests" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "scope" character varying NOT NULL, "key" character varying NOT NULL, "request_hash" character varying NOT NULL, "response_body" jsonb NULL, PRIMARY KEY ("id"));
-- create index "idempotentrequest_scope_key" to table: "idempotent_requests"
CREATE UNIQUE INDEX "idempotentrequest_scope_key" ON "idempotent_requests" ("scope", "key");
-- create "order_payables" table
CREATE TABLE "order_payables" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "checkout_id" character varying NOT NULL, "order_id" character varying NOT NULL, "order_reference" character varying NOT NULL, "buyer_user_id" character varying NOT NULL, "store_id" character varying NOT NULL, "seller_user_id" character varying NOT NULL, "amount_minor" bigint NOT NULL, "currency" character varying NOT NULL, "product_summary" character varying NOT NULL DEFAULT '', "payment_mode" character varying NOT NULL DEFAULT 'escrow', "store_verified" boolean NOT NULL DEFAULT false, PRIMARY KEY ("id"), CONSTRAINT "order_payables_amount_positive" CHECK (amount_minor > 0));
-- create index "orderpayable_checkout_id" to table: "order_payables"
CREATE INDEX "orderpayable_checkout_id" ON "order_payables" ("checkout_id");
-- create index "orderpayable_order_id" to table: "order_payables"
CREATE UNIQUE INDEX "orderpayable_order_id" ON "order_payables" ("order_id");
-- create "outbox_events" table
CREATE TABLE "outbox_events" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "event_type" character varying NOT NULL, "subject" character varying NOT NULL, "payload" jsonb NOT NULL, "published_at" timestamptz NULL, "attempt_count" bigint NOT NULL DEFAULT 0, "next_attempt_at" timestamptz NULL, "last_error" character varying NOT NULL DEFAULT '', "dead_lettered_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "outboxevent_published_at_dead_lettered_at_created_at" to table: "outbox_events"
CREATE INDEX "outboxevent_published_at_dead_lettered_at_created_at" ON "outbox_events" ("published_at", "dead_lettered_at", "created_at");
-- create "payment_intents" table
CREATE TABLE "payment_intents" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "reference" character varying NOT NULL, "purpose" character varying NOT NULL, "owner_user_id" character varying NOT NULL, "subject_id" character varying NOT NULL, "provider" character varying NOT NULL, "amount_minor" bigint NOT NULL, "currency" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "authorization_url" character varying NOT NULL DEFAULT '', "provider_transaction_id" character varying NOT NULL DEFAULT '', "provider_fee_minor" bigint NOT NULL DEFAULT 0, "failure_reason" character varying NOT NULL DEFAULT '', "paid_at" timestamptz NULL, "failed_at" timestamptz NULL, "refunded_minor" bigint NOT NULL DEFAULT 0, "version" bigint NOT NULL DEFAULT 0, "metadata" jsonb NOT NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "payment_intents_amount_positive" CHECK (amount_minor > 0), CONSTRAINT "payment_intents_provider_fee_not_negative" CHECK (provider_fee_minor >= 0), CONSTRAINT "payment_intents_refunds_within_amount" CHECK ((refunded_minor >= 0) AND (refunded_minor <= amount_minor)));
-- create index "paymentintent_owner_user_id_created_at" to table: "payment_intents"
CREATE INDEX "paymentintent_owner_user_id_created_at" ON "payment_intents" ("owner_user_id", "created_at");
-- create index "paymentintent_purpose_subject_id" to table: "payment_intents"
CREATE INDEX "paymentintent_purpose_subject_id" ON "payment_intents" ("purpose", "subject_id");
-- create index "paymentintent_reference" to table: "payment_intents"
CREATE UNIQUE INDEX "paymentintent_reference" ON "payment_intents" ("reference");
-- create index "paymentintent_status_created_at" to table: "payment_intents"
CREATE INDEX "paymentintent_status_created_at" ON "payment_intents" ("status", "created_at");
-- create "payment_refunds" table
CREATE TABLE "payment_refunds" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "payment_intent_id" uuid NOT NULL, "reference" character varying NOT NULL, "provider" character varying NOT NULL, "amount_minor" bigint NOT NULL, "currency" character varying NOT NULL, "reason" character varying NOT NULL DEFAULT '', "status" character varying NOT NULL DEFAULT 'pending', "provider_refund_id" character varying NOT NULL DEFAULT '', "failure_reason" character varying NOT NULL DEFAULT '', "attempt_count" bigint NOT NULL DEFAULT 0, "completed_at" timestamptz NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "payment_refunds_amount_positive" CHECK (amount_minor > 0));
-- create index "paymentrefund_payment_intent_id" to table: "payment_refunds"
CREATE INDEX "paymentrefund_payment_intent_id" ON "payment_refunds" ("payment_intent_id");
-- create index "paymentrefund_reference" to table: "payment_refunds"
CREATE UNIQUE INDEX "paymentrefund_reference" ON "payment_refunds" ("reference");
-- create index "paymentrefund_status_created_at" to table: "payment_refunds"
CREATE INDEX "paymentrefund_status_created_at" ON "payment_refunds" ("status", "created_at");
-- create "payout_transfers" table
CREATE TABLE "payout_transfers" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "reference" character varying NOT NULL, "purpose" character varying NOT NULL, "subject_id" character varying NOT NULL, "provider" character varying NOT NULL, "amount_minor" bigint NOT NULL, "currency" character varying NOT NULL, "bank_code" character varying NOT NULL, "destination_last4" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'processing', "provider_transfer_code" character varying NOT NULL DEFAULT '', "failure_reason" character varying NOT NULL DEFAULT '', "completed_at" timestamptz NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "payout_transfers_amount_positive" CHECK (amount_minor > 0));
-- create index "payouttransfer_purpose_subject_id" to table: "payout_transfers"
CREATE INDEX "payouttransfer_purpose_subject_id" ON "payout_transfers" ("purpose", "subject_id");
-- create index "payouttransfer_reference" to table: "payout_transfers"
CREATE UNIQUE INDEX "payouttransfer_reference" ON "payout_transfers" ("reference");
-- create index "payouttransfer_status_created_at" to table: "payout_transfers"
CREATE INDEX "payouttransfer_status_created_at" ON "payout_transfers" ("status", "created_at");
-- create "store_purchases" table
CREATE TABLE "store_purchases" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store" character varying NOT NULL, "store_transaction_id" character varying NOT NULL, "original_transaction_id" character varying NOT NULL DEFAULT '', "product_id" character varying NOT NULL, "user_id" character varying NOT NULL, "purpose" character varying NOT NULL, "subject_id" character varying NOT NULL, "price_minor" bigint NOT NULL, "currency" character varying NOT NULL, "store_fee_minor" bigint NOT NULL, "environment" character varying NOT NULL DEFAULT 'production', "status" character varying NOT NULL DEFAULT 'verified', "refunded_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "storepurchase_store_store_transaction_id" to table: "store_purchases"
CREATE UNIQUE INDEX "storepurchase_store_store_transaction_id" ON "store_purchases" ("store", "store_transaction_id");
-- create index "storepurchase_user_id_created_at" to table: "store_purchases"
CREATE INDEX "storepurchase_user_id_created_at" ON "store_purchases" ("user_id", "created_at");
-- create "webhook_events" table
CREATE TABLE "webhook_events" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "provider" character varying NOT NULL, "event_key" character varying NOT NULL, "event_type" character varying NOT NULL, "reference" character varying NOT NULL, "payload_sha256" character varying NOT NULL, "processed_at" timestamptz NULL, "attempt_count" bigint NOT NULL DEFAULT 0, "last_error" character varying NOT NULL DEFAULT '', PRIMARY KEY ("id"));
-- create index "webhookevent_processed_at_created_at" to table: "webhook_events"
CREATE INDEX "webhookevent_processed_at_created_at" ON "webhook_events" ("processed_at", "created_at");
-- create index "webhookevent_provider_event_key" to table: "webhook_events"
CREATE UNIQUE INDEX "webhookevent_provider_event_key" ON "webhook_events" ("provider", "event_key");
