-- CreateTable
CREATE TABLE "post_tags" (
    "postId" UUID NOT NULL,
    "taggedUserId" UUID NOT NULL,
    "taggedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_tags_pkey" PRIMARY KEY ("postId","taggedUserId")
);

-- CreateTable
CREATE TABLE "tagging_settings" (
    "accountId" UUID NOT NULL,
    "allowTagging" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tagging_settings_pkey" PRIMARY KEY ("accountId")
);

-- CreateIndex
CREATE INDEX "post_tags_postId_createdAt_taggedUserId_idx" ON "post_tags"("postId", "createdAt", "taggedUserId");

-- CreateIndex
CREATE INDEX "post_tags_taggedUserId_createdAt_idx" ON "post_tags"("taggedUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
