-- CreateEnum
CREATE TYPE "FollowEndedBy" AS ENUM ('requester', 'owner');

-- AlterTable
ALTER TABLE "follows" ADD COLUMN "endedBy" "FollowEndedBy";
