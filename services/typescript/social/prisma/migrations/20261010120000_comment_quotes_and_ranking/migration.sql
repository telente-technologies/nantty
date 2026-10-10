-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "quotedPostId" UUID;

-- CreateIndex
CREATE INDEX "comments_quotedPostId_idx" ON "comments"("quotedPostId");

-- CreateTable
CREATE TABLE "comment_rank_snapshots" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "viewerId" UUID,
    "pinnedCommentId" UUID,
    "commentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_rank_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comment_rank_snapshots_createdAt_idx" ON "comment_rank_snapshots"("createdAt");
