-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "kind" TEXT,
    "templateKey" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actor" JSONB,
    "data" JSONB NOT NULL DEFAULT '{}',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT,
    "channel" TEXT NOT NULL,
    "templateKey" TEXT,
    "mailKind" TEXT,
    "status" TEXT NOT NULL,
    "skipReason" TEXT,
    "providerMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "push" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_suppressions" (
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "bulk_campaigns" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "audienceKind" TEXT NOT NULL,
    "audienceLabel" TEXT NOT NULL,
    "audienceRef" TEXT NOT NULL,
    "mailKind" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "skippedNoMarketingConsent" INTEGER NOT NULL DEFAULT 0,
    "skippedHardBounces" INTEGER NOT NULL DEFAULT 0,
    "skippedSuppressed" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "batchSize" INTEGER NOT NULL,
    "ratePerSecond" INTEGER NOT NULL,
    "batchesTotal" INTEGER NOT NULL DEFAULT 0,
    "batchesDone" INTEGER NOT NULL DEFAULT 0,
    "nextCursor" TEXT,
    "reason" TEXT,
    "queuedById" TEXT NOT NULL,
    "queuedByName" TEXT NOT NULL,
    "versionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "bulk_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_drafts" (
    "versionId" TEXT NOT NULL,
    "documentKey" TEXT NOT NULL,
    "documentTitle" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "subject" TEXT NOT NULL,
    "summaryText" TEXT NOT NULL,
    "whatChanged" JSONB NOT NULL DEFAULT '[]',
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "reacceptNote" TEXT,
    "documentUrl" TEXT NOT NULL,
    "requiresReacceptance" BOOLEAN NOT NULL DEFAULT false,
    "updatedByName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "testSends" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "notice_drafts_pkey" PRIMARY KEY ("versionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupeKey_key" ON "notifications"("dedupeKey");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_id_idx" ON "notifications"("userId", "createdAt" DESC, "id");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "notifications_userId_kind_createdAt_idx" ON "notifications"("userId", "kind", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_dedupeKey_key" ON "deliveries"("dedupeKey");

-- CreateIndex
CREATE INDEX "deliveries_userId_channel_mailKind_status_createdAt_idx" ON "deliveries"("userId", "channel", "mailKind", "status", "createdAt");

-- CreateIndex
CREATE INDEX "deliveries_eventId_idx" ON "deliveries"("eventId");

-- CreateIndex
CREATE INDEX "deliveries_providerMessageId_idx" ON "deliveries"("providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_category_key" ON "notification_preferences"("userId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_token_key" ON "device_tokens"("token");

-- CreateIndex
CREATE INDEX "device_tokens_userId_idx" ON "device_tokens"("userId");

-- CreateIndex
CREATE INDEX "email_suppressions_reason_idx" ON "email_suppressions"("reason");

-- CreateIndex
CREATE INDEX "bulk_campaigns_kind_createdAt_idx" ON "bulk_campaigns"("kind", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "bulk_campaigns_versionId_status_idx" ON "bulk_campaigns"("versionId", "status");

