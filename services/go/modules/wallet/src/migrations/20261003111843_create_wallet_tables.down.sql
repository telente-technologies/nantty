-- reverse: create index "withdrawal_user_id_created_at" to table: "withdrawals"
DROP INDEX "withdrawal_user_id_created_at";
-- reverse: create index "withdrawal_status_created_at" to table: "withdrawals"
DROP INDEX "withdrawal_status_created_at";
-- reverse: create index "withdrawal_reference" to table: "withdrawals"
DROP INDEX "withdrawal_reference";
-- reverse: create "withdrawals" table
DROP TABLE "withdrawals";
-- reverse: create index "walletriskflag_user_id_resolved_at" to table: "wallet_risk_flags"
DROP INDEX "walletriskflag_user_id_resolved_at";
-- reverse: create "wallet_risk_flags" table
DROP TABLE "wallet_risk_flags";
-- reverse: create index "payoutaccount_user_id_deleted_at" to table: "payout_accounts"
DROP INDEX "payoutaccount_user_id_deleted_at";
-- reverse: create index "payoutaccount_user_id_account_number_fingerprint_bank_code" to table: "payout_accounts"
DROP INDEX "payoutaccount_user_id_account_number_fingerprint_bank_code";
-- reverse: create "payout_accounts" table
DROP TABLE "payout_accounts";
-- reverse: create index "outboxevent_published_at_dead_lettered_at_created_at" to table: "outbox_events"
DROP INDEX "outboxevent_published_at_dead_lettered_at_created_at";
-- reverse: create "outbox_events" table
DROP TABLE "outbox_events";
-- reverse: create index "idempotentrequest_scope_key" to table: "idempotent_requests"
DROP INDEX "idempotentrequest_scope_key";
-- reverse: create "idempotent_requests" table
DROP TABLE "idempotent_requests";
-- reverse: create index "cointransfer_sender_user_id_created_at" to table: "coin_transfers"
DROP INDEX "cointransfer_sender_user_id_created_at";
-- reverse: create index "cointransfer_recipient_user_id_created_at" to table: "coin_transfers"
DROP INDEX "cointransfer_recipient_user_id_created_at";
-- reverse: create "coin_transfers" table
DROP TABLE "coin_transfers";
-- reverse: create index "coinpurchase_user_id_created_at" to table: "coin_purchases"
DROP INDEX "coinpurchase_user_id_created_at";
-- reverse: create index "coinpurchase_reference" to table: "coin_purchases"
DROP INDEX "coinpurchase_reference";
-- reverse: create "coin_purchases" table
DROP TABLE "coin_purchases";
-- reverse: create index "coinpackage_store_product_id" to table: "coin_packages"
DROP INDEX "coinpackage_store_product_id";
-- reverse: create index "coinpackage_purchase_channel_active_sort_order" to table: "coin_packages"
DROP INDEX "coinpackage_purchase_channel_active_sort_order";
-- reverse: create "coin_packages" table
DROP TABLE "coin_packages";
-- reverse: create index "coinconversion_user_id_created_at" to table: "coin_conversions"
DROP INDEX "coinconversion_user_id_created_at";
-- reverse: create "coin_conversions" table
DROP TABLE "coin_conversions";
