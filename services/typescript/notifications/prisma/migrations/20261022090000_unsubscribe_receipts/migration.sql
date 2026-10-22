CREATE TABLE "unsubscribe_receipts" (
    "tokenHash" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unsubscribe_receipts_pkey" PRIMARY KEY ("tokenHash")
);

CREATE INDEX "unsubscribe_receipts_accountId_idx" ON "unsubscribe_receipts"("accountId");
