-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "linkPreview" JSONB;

-- CreateTable
CREATE TABLE "link_preview_cache" (
    "normalizedUrl" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "siteName" TEXT,
    "imageUrl" TEXT,
    "imageMediaId" UUID,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "link_preview_cache_pkey" PRIMARY KEY ("normalizedUrl")
);

-- CreateIndex
CREATE INDEX "link_preview_cache_expiresAt_idx" ON "link_preview_cache"("expiresAt");

