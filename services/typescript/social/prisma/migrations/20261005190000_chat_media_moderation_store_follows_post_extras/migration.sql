-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "idempotency_records" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "requestHash" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "responseStatus" DROP NOT NULL;

UPDATE "idempotency_records" SET "completedAt" = "createdAt" WHERE "completedAt" IS NULL;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "hiddenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "post_daily_stats" ADD COLUMN     "linkClicks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "newFollows" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "videoViews" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "watchTimeSeconds" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "clipEdit" JSONB,
ADD COLUMN     "location" JSONB,
ADD COLUMN     "productIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "topics" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "store_follows" (
    "followerId" UUID NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_follows_pkey" PRIMARY KEY ("followerId","storeId")
);

-- CreateIndex
CREATE INDEX "store_follows_storeId_createdAt_idx" ON "store_follows"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "store_follows_followerId_createdAt_idx" ON "store_follows"("followerId", "createdAt");
