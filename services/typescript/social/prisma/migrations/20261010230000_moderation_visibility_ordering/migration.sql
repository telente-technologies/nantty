-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "moderationVisibilityAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "moderationVisibilityAt" TIMESTAMP(3);
