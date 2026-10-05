-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "store_id" TEXT;

-- Backfill
UPDATE "documents" SET "store_id" = "summary"->>'storeId' WHERE "kind" = 'product';

-- CreateIndex
CREATE INDEX "documents_store_id_idx" ON "documents"("store_id");

-- AlterTable
ALTER TABLE "recent_searches" ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'global';

-- DropIndex
DROP INDEX "recent_searches_account_id_query_normalized_key";

-- DropIndex
DROP INDEX "recent_searches_account_id_searched_at_idx";

-- CreateIndex
CREATE UNIQUE INDEX "recent_searches_account_id_scope_query_normalized_key" ON "recent_searches"("account_id", "scope", "query_normalized");

-- CreateIndex
CREATE INDEX "recent_searches_account_id_scope_searched_at_idx" ON "recent_searches"("account_id", "scope", "searched_at" DESC);
