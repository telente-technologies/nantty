-- modify "coin_packages" table
ALTER TABLE "coin_packages" ADD COLUMN "client_platform" character varying NOT NULL DEFAULT 'web';
-- create index "coinpackage_client_platform_active_sort_order" to table: "coin_packages"
CREATE INDEX "coinpackage_client_platform_active_sort_order" ON "coin_packages" ("client_platform", "active", "sort_order");
-- drop index "withdrawal_status_created_at" from table: "withdrawals"
DROP INDEX "withdrawal_status_created_at";
-- drop index "withdrawal_user_id_created_at" from table: "withdrawals"
DROP INDEX "withdrawal_user_id_created_at";
-- create index "withdrawal_queued_created_at" to table: "withdrawals"
CREATE INDEX "withdrawal_queued_created_at" ON "withdrawals" ("created_at") WHERE ((status)::text = 'queued'::text);
-- create index "withdrawal_status_id" to table: "withdrawals"
CREATE INDEX "withdrawal_status_id" ON "withdrawals" ("status", "id" DESC);
-- create index "withdrawal_user_id_id" to table: "withdrawals"
CREATE INDEX "withdrawal_user_id_id" ON "withdrawals" ("user_id", "id" DESC);
