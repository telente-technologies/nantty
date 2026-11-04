ALTER TABLE "deliveries"
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
  ADD COLUMN "failedAt" TIMESTAMP(3);

CREATE INDEX "deliveries_status_failedAt_idx" ON "deliveries"("status", "failedAt");
