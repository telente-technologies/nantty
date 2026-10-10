-- CreateTable
CREATE TABLE "post_notification_mutes" (
    "userId" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_notification_mutes_pkey" PRIMARY KEY ("userId","postId")
);

-- CreateIndex
CREATE INDEX "post_notification_mutes_postId_idx" ON "post_notification_mutes"("postId");
