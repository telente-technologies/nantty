-- CreateEnum
CREATE TYPE "ReplyPolicy" AS ENUM ('everyone', 'following', 'followers', 'mentioned', 'off');

-- CreateEnum
CREATE TYPE "SensitiveLabel" AS ENUM ('nudity', 'graphic_violence', 'dangerous_acts', 'self_harm');

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "quoteCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isQuote" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "replyPolicy" "ReplyPolicy" NOT NULL DEFAULT 'everyone',
ADD COLUMN     "sensitiveLabels" "SensitiveLabel"[] DEFAULT ARRAY[]::"SensitiveLabel"[],
ADD COLUMN     "authorSensitiveLabels" "SensitiveLabel"[] DEFAULT ARRAY[]::"SensitiveLabel"[],
ADD COLUMN     "moderationSensitiveLabels" "SensitiveLabel"[] DEFAULT ARRAY[]::"SensitiveLabel"[],
ADD COLUMN     "advisorySensitiveLabels" "SensitiveLabel"[] DEFAULT ARRAY[]::"SensitiveLabel"[],
ADD COLUMN     "sensitiveLabelsReviewed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "depth" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "path" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "content_preferences" (
    "accountId" UUID NOT NULL,
    "showSensitiveWithoutWarning" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_preferences_pkey" PRIMARY KEY ("accountId")
);

-- CreateIndex
CREATE INDEX "posts_resharedFromId_isQuote_id_idx" ON "posts"("resharedFromId", "isQuote", "id");

-- CreateIndex
CREATE INDEX "comments_rootCommentId_path_idx" ON "comments"("rootCommentId", "path");

-- Backfill
WITH RECURSIVE thread AS (
    SELECT "id", 0 AS "depth", "id"::text AS "path" FROM "comments" WHERE "parentCommentId" IS NULL
    UNION ALL
    SELECT child."id", thread."depth" + 1, thread."path" || '/' || child."id"::text
    FROM "comments" child JOIN thread ON child."parentCommentId" = thread."id"
)
UPDATE "comments" SET "depth" = thread."depth", "path" = thread."path" FROM thread WHERE "comments"."id" = thread."id";

UPDATE "posts" SET "isQuote" = true WHERE "resharedFromId" IS NOT NULL AND "text" <> '';

UPDATE "posts" AS original SET "quoteCount" = counted.total
FROM (SELECT "resharedFromId", count(*)::int AS total FROM "posts" WHERE "isQuote" AND "deletedAt" IS NULL GROUP BY "resharedFromId") AS counted
WHERE original."id" = counted."resharedFromId";
