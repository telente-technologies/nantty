-- create "dispute_messages" table
CREATE TABLE "dispute_messages" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "dispute_id" uuid NOT NULL, "author_user_id" character varying NOT NULL, "author_role" character varying NOT NULL, "text" character varying NOT NULL, "attachment_urls" jsonb NOT NULL, PRIMARY KEY ("id"));
-- create index "disputemessage_dispute_id_created_at" to table: "dispute_messages"
CREATE INDEX "disputemessage_dispute_id_created_at" ON "dispute_messages" ("dispute_id", "created_at");
-- create "dispute_status_events" table
CREATE TABLE "dispute_status_events" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "dispute_id" uuid NOT NULL, "status" character varying NOT NULL, "label" character varying NOT NULL, PRIMARY KEY ("id"));
-- create index "disputestatusevent_dispute_id_created_at" to table: "dispute_status_events"
CREATE INDEX "disputestatusevent_dispute_id_created_at" ON "dispute_status_events" ("dispute_id", "created_at");
-- create "escrows" table
CREATE TABLE "escrows" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "order_id" character varying NOT NULL, "order_reference" character varying NOT NULL, "checkout_id" character varying NOT NULL, "payment_intent_id" uuid NOT NULL, "payment_reference" character varying NOT NULL, "provider" character varying NOT NULL, "buyer_user_id" character varying NOT NULL, "store_id" character varying NOT NULL, "seller_user_id" character varying NOT NULL, "product_summary" character varying NOT NULL DEFAULT '', "payment_mode" character varying NOT NULL DEFAULT 'escrow', "amount_minor" bigint NOT NULL, "currency" character varying NOT NULL, "commission_bps" bigint NOT NULL, "commission_minor" bigint NOT NULL, "seller_amount_minor" bigint NOT NULL, "refunded_minor" bigint NOT NULL DEFAULT 0, "released_to_seller_minor" bigint NOT NULL DEFAULT 0, "status" character varying NOT NULL DEFAULT 'held', "shipped_at" timestamptz NULL, "estimated_delivery_at" timestamptz NULL, "courier_name" character varying NOT NULL DEFAULT '', "tracking_number" character varying NOT NULL DEFAULT '', "tracking_url" character varying NOT NULL DEFAULT '', "delivered_at" timestamptz NULL, "auto_release_at" timestamptz NULL, "buyer_confirmed_at" timestamptz NULL, "released_at" timestamptz NULL, "refunded_at" timestamptz NULL, "release_trigger" character varying NOT NULL DEFAULT '', "version" bigint NOT NULL DEFAULT 0, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "escrows_amount_positive" CHECK (amount_minor > 0), CONSTRAINT "escrows_commission_bps_in_range" CHECK ((commission_bps >= 0) AND (commission_bps <= 10000)), CONSTRAINT "escrows_refund_within_amount" CHECK ((refunded_minor >= 0) AND (refunded_minor <= amount_minor)), CONSTRAINT "escrows_split_sums_to_amount" CHECK ((commission_minor >= 0) AND (seller_amount_minor >= 0) AND ((commission_minor + seller_amount_minor) = amount_minor)));
-- create index "escrow_buyer_user_id_created_at" to table: "escrows"
CREATE INDEX "escrow_buyer_user_id_created_at" ON "escrows" ("buyer_user_id", "created_at");
-- create index "escrow_checkout_id" to table: "escrows"
CREATE INDEX "escrow_checkout_id" ON "escrows" ("checkout_id");
-- create index "escrow_order_id" to table: "escrows"
CREATE UNIQUE INDEX "escrow_order_id" ON "escrows" ("order_id");
-- create index "escrow_seller_user_id_status" to table: "escrows"
CREATE INDEX "escrow_seller_user_id_status" ON "escrows" ("seller_user_id", "status");
-- create index "escrow_status_auto_release_at" to table: "escrows"
CREATE INDEX "escrow_status_auto_release_at" ON "escrows" ("status", "auto_release_at");
-- create "escrow_events" table
CREATE TABLE "escrow_events" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "escrow_id" uuid NOT NULL, "event_type" character varying NOT NULL, "actor_type" character varying NOT NULL DEFAULT 'system', "actor_id" character varying NOT NULL DEFAULT '', "details" jsonb NOT NULL, PRIMARY KEY ("id"));
-- create index "escrowevent_escrow_id_created_at" to table: "escrow_events"
CREATE INDEX "escrowevent_escrow_id_created_at" ON "escrow_events" ("escrow_id", "created_at");
-- create "idempotent_requests" table
CREATE TABLE "idempotent_requests" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "scope" character varying NOT NULL, "key" character varying NOT NULL, "request_hash" character varying NOT NULL, "response_body" jsonb NULL, PRIMARY KEY ("id"));
-- create index "idempotentrequest_scope_key" to table: "idempotent_requests"
CREATE UNIQUE INDEX "idempotentrequest_scope_key" ON "idempotent_requests" ("scope", "key");
-- create "outbox_events" table
CREATE TABLE "outbox_events" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "event_type" character varying NOT NULL, "subject" character varying NOT NULL, "payload" jsonb NOT NULL, "published_at" timestamptz NULL, "attempt_count" bigint NOT NULL DEFAULT 0, "next_attempt_at" timestamptz NULL, "last_error" character varying NOT NULL DEFAULT '', "dead_lettered_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "outboxevent_published_at_dead_lettered_at_created_at" to table: "outbox_events"
CREATE INDEX "outboxevent_published_at_dead_lettered_at_created_at" ON "outbox_events" ("published_at", "dead_lettered_at", "created_at");
-- create "disputes" table
CREATE TABLE "disputes" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "order_id" character varying NOT NULL, "opened_by_user_id" character varying NOT NULL, "reason" character varying NOT NULL, "description" character varying NOT NULL DEFAULT '', "evidence_urls" jsonb NOT NULL, "status" character varying NOT NULL DEFAULT 'awaiting_seller', "respond_by_at" timestamptz NULL, "resolution_note" character varying NOT NULL DEFAULT '', "refund_amount_minor" bigint NOT NULL DEFAULT 0, "resolved_by_staff_id" character varying NOT NULL DEFAULT '', "resolved_at" timestamptz NULL, "version" bigint NOT NULL DEFAULT 0, "updated_at" timestamptz NOT NULL, "escrow_id" uuid NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "disputes_escrows_disputes" FOREIGN KEY ("escrow_id") REFERENCES "escrows" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION);
-- create index "dispute_escrow_id" to table: "disputes"
CREATE INDEX "dispute_escrow_id" ON "disputes" ("escrow_id");
-- create index "dispute_opened_by_user_id_created_at" to table: "disputes"
CREATE INDEX "dispute_opened_by_user_id_created_at" ON "disputes" ("opened_by_user_id", "created_at");
-- create index "dispute_order_id" to table: "disputes"
CREATE INDEX "dispute_order_id" ON "disputes" ("order_id");
-- create index "dispute_status_created_at" to table: "disputes"
CREATE INDEX "dispute_status_created_at" ON "disputes" ("status", "created_at");
