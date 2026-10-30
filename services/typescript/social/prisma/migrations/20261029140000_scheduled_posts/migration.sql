-- Additive scheduling state. Existing posts remain published during rollout.
CREATE TYPE "PostPublicationState" AS ENUM ('published', 'scheduled', 'cancelled', 'failed');
CREATE TYPE "PostPublicationFailureReason" AS ENUM ('media_failed', 'media_processing_timeout', 'author_unavailable', 'profile_unavailable');

ALTER TABLE "posts"
  ADD COLUMN "publicationState" "PostPublicationState" NOT NULL DEFAULT 'published',
  ADD COLUMN "scheduledAt" TIMESTAMP(3),
  ADD COLUMN "scheduledTaggedUserIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "publicationFailureReason" "PostPublicationFailureReason";

CREATE INDEX "posts_publicationState_scheduledAt_idx"
  ON "posts"("publicationState", "scheduledAt");
