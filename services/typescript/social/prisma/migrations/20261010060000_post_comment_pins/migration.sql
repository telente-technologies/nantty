-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pinnedAt" TIMESTAMP(3),
ADD COLUMN     "pinnedCommentId" UUID;

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pinnedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "posts_authorId_isPinned_idx" ON "posts"("authorId", "isPinned");

-- CreateIndex
CREATE INDEX "comments_postId_isPinned_idx" ON "comments"("postId", "isPinned");
