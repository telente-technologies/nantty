-- CreateEnum
CREATE TYPE "PostNotificationLevel" AS ENUM ('off', 'posts', 'posts_and_lives');

-- AlterTable
ALTER TABLE "follows" ADD COLUMN "postNotifications" "PostNotificationLevel" NOT NULL DEFAULT 'off';

-- CreateIndex
CREATE INDEX "follows_followeeId_postNotifications_id_idx" ON "follows"("followeeId", "postNotifications", "id");
