-- CreateEnum
CREATE TYPE "ModerationVisibility" AS ENUM ('visible', 'restricted', 'hidden', 'removed');

-- CreateEnum
CREATE TYPE "MediaProcessingStatus" AS ENUM ('processing', 'ready', 'failed');

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "mediaStatus" "MediaProcessingStatus";

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "moderationVisibility" "ModerationVisibility" NOT NULL DEFAULT 'visible',
ADD COLUMN     "saveCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "post_media" ADD COLUMN     "status" "MediaProcessingStatus" NOT NULL DEFAULT 'ready';

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "moderationVisibility" "ModerationVisibility" NOT NULL DEFAULT 'visible';

-- CreateTable
CREATE TABLE "save_counters" (
    "type" "SavedItemType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "save_counters_pkey" PRIMARY KEY ("type","targetId")
);

-- CreateIndex
CREATE INDEX "messages_mediaId_idx" ON "messages"("mediaId");

