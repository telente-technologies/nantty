-- CreateEnum
CREATE TYPE "MediaPurpose" AS ENUM ('post', 'clip', 'story', 'avatar', 'banner', 'product', 'chat', 'voice', 'document', 'kyc', 'adCreative', 'dispute_evidence', 'identity_document', 'verification_document');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('image', 'video', 'audio', 'document');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('uploading', 'uploaded', 'processing', 'held', 'ready', 'rejected', 'deleted');

-- CreateEnum
CREATE TYPE "UploadSessionStatus" AS ENUM ('uploading', 'completed', 'aborted', 'expired');

-- CreateTable
CREATE TABLE "upload_sessions" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "purpose" "MediaPurpose" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "sha256" TEXT,
    "idempotencyKey" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'multipart',
    "objectKey" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "s3UploadId" TEXT,
    "chunkSizeBytes" INTEGER NOT NULL,
    "totalChunks" INTEGER NOT NULL,
    "status" "UploadSessionStatus" NOT NULL DEFAULT 'uploading',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "upload_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "purpose" "MediaPurpose" NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "status" "MediaStatus" NOT NULL DEFAULT 'uploading',
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "declaredMimeType" TEXT NOT NULL,
    "sniffedMimeType" TEXT,
    "sizeBytes" BIGINT NOT NULL,
    "sha256" TEXT,
    "quarantineBucket" TEXT NOT NULL,
    "quarantineKey" TEXT NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 0,
    "height" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" DOUBLE PRECISION,
    "pageCount" INTEGER,
    "blurhash" TEXT,
    "posterKey" TEXT,
    "hlsKey" TEXT,
    "scanResult" TEXT,
    "moderationScore" DOUBLE PRECISION,
    "moderationDecision" TEXT,
    "rejectionReason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_variants" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bitrateKbps" INTEGER,
    "sizeBytes" BIGINT NOT NULL,

    CONSTRAINT "media_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_access_logs" (
    "id" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "lockToken" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "upload_sessions_mediaId_key" ON "upload_sessions"("mediaId");

-- CreateIndex
CREATE INDEX "upload_sessions_status_expiresAt_idx" ON "upload_sessions"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "upload_sessions_ownerId_idempotencyKey_key" ON "upload_sessions"("ownerId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "media_assets_ownerId_createdAt_idx" ON "media_assets"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "media_assets_status_updatedAt_idx" ON "media_assets"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "media_assets_expiresAt_idx" ON "media_assets"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "media_variants_assetId_key_key" ON "media_variants"("assetId", "key");

-- CreateIndex
CREATE INDEX "media_access_logs_mediaId_createdAt_idx" ON "media_access_logs"("mediaId", "createdAt");

-- CreateIndex
CREATE INDEX "outbox_events_publishedAt_createdAt_idx" ON "outbox_events"("publishedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "media_variants" ADD CONSTRAINT "media_variants_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_access_logs" ADD CONSTRAINT "media_access_logs_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

