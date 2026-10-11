-- AlterTable
ALTER TABLE "post_viewers" ADD COLUMN "lastDwellAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "comment_rank_snapshots_postId_viewerId_createdAt_idx" ON "comment_rank_snapshots"("postId", "viewerId", "createdAt");

-- CreateIndex
CREATE INDEX "feed_rank_snapshots_viewerId_surface_createdAt_idx" ON "feed_rank_snapshots"("viewerId", "surface", "createdAt");
