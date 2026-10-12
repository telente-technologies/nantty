-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "hiddenByUserId" UUID;

-- CreateIndex
CREATE INDEX "comments_postId_hiddenAt_idx" ON "comments"("postId", "hiddenAt");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
