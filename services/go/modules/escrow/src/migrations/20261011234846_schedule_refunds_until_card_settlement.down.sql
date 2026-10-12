-- reverse: create index "pendingrefund_status_created_at" to table: "pending_refunds"
DROP INDEX "pendingrefund_status_created_at";
-- reverse: create index "pendingrefund_escrow_id_request_key" to table: "pending_refunds"
DROP INDEX "pendingrefund_escrow_id_request_key";
-- reverse: create "pending_refunds" table
DROP TABLE "pending_refunds";
