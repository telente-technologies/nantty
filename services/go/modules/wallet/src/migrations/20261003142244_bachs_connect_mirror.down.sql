-- reverse: create index "withdrawal_user_id_id" to table: "withdrawals"
DROP INDEX "withdrawal_user_id_id";
-- reverse: create index "withdrawal_status_id" to table: "withdrawals"
DROP INDEX "withdrawal_status_id";
-- reverse: create index "withdrawal_queued_created_at" to table: "withdrawals"
DROP INDEX "withdrawal_queued_created_at";
-- reverse: drop index "withdrawal_user_id_created_at" from table: "withdrawals"
CREATE INDEX "withdrawal_user_id_created_at" ON "withdrawals" ("user_id", "created_at");
-- reverse: drop index "withdrawal_status_created_at" from table: "withdrawals"
CREATE INDEX "withdrawal_status_created_at" ON "withdrawals" ("status", "created_at");
-- reverse: create index "coinpackage_client_platform_active_sort_order" to table: "coin_packages"
DROP INDEX "coinpackage_client_platform_active_sort_order";
-- reverse: modify "coin_packages" table
ALTER TABLE "coin_packages" DROP COLUMN "client_platform";
