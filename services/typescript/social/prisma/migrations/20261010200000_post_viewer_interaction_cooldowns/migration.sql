-- AlterTable
ALTER TABLE "post_viewers" ADD COLUMN     "followAttributedAt" TIMESTAMP(3),
ADD COLUMN     "lastLinkClickAt" TIMESTAMP(3),
ADD COLUMN     "lastProfileClickAt" TIMESTAMP(3),
ADD COLUMN     "lastViewedAt" TIMESTAMP(3),
ADD COLUMN     "lastWatchedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "post_daily_stats" ADD COLUMN     "completedViews" INTEGER NOT NULL DEFAULT 0;

-- Backfill: existing viewer rows were all created by a counted view
UPDATE "post_viewers" SET "lastViewedAt" = "createdAt" WHERE "lastViewedAt" IS NULL;
