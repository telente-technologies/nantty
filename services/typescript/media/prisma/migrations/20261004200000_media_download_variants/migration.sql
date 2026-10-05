-- CreateEnum
CREATE TYPE "DownloadVariantStatus" AS ENUM ('pending', 'rendering', 'ready', 'failed');

-- CreateTable
CREATE TABLE "media_download_variants" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "watermarkHandle" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "stripAudio" BOOLEAN NOT NULL DEFAULT false,
    "status" "DownloadVariantStatus" NOT NULL DEFAULT 'pending',
    "bucket" TEXT,
    "key" TEXT,
    "contentType" TEXT,
    "sizeBytes" BIGINT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),

    CONSTRAINT "media_download_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_download_variants_status_createdAt_idx" ON "media_download_variants"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "media_download_variants_assetId_cacheKey_key" ON "media_download_variants"("assetId", "cacheKey");

-- AddForeignKey
ALTER TABLE "media_download_variants" ADD CONSTRAINT "media_download_variants_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

