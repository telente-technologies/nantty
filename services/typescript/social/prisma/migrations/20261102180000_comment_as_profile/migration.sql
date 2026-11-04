ALTER TABLE "comments"
ADD COLUMN "authorProfileId" UUID;

CREATE INDEX "comments_authorProfileId_idx" ON "comments"("authorProfileId");
