-- create "product_import_jobs" table
CREATE TABLE "product_import_jobs" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "actor_account_id" uuid NOT NULL, "location_id" uuid NOT NULL, "idempotency_key" character varying NOT NULL, "request_hash" character varying NOT NULL, "rows" bytea NOT NULL, "status" character varying NOT NULL DEFAULT 'queued', "created_count" bigint NOT NULL DEFAULT 0, "updated_count" bigint NOT NULL DEFAULT 0, "failures" jsonb NULL, "finished_at" timestamptz NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "productimportjob_status_id" to table: "product_import_jobs"
CREATE INDEX "productimportjob_status_id" ON "product_import_jobs" ("status", "id");
-- create index "productimportjob_store_id_idempotency_key" to table: "product_import_jobs"
CREATE UNIQUE INDEX "productimportjob_store_id_idempotency_key" ON "product_import_jobs" ("store_id", "idempotency_key");
