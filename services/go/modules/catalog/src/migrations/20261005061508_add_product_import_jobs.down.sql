-- reverse: create index "productimportjob_store_id_idempotency_key" to table: "product_import_jobs"
DROP INDEX "productimportjob_store_id_idempotency_key";
-- reverse: create index "productimportjob_status_id" to table: "product_import_jobs"
DROP INDEX "productimportjob_status_id";
-- reverse: create "product_import_jobs" table
DROP TABLE "product_import_jobs";
