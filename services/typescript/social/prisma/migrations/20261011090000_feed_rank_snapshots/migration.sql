-- CreateTable
CREATE TABLE "feed_rank_snapshots" (
    "id" UUID NOT NULL,
    "viewerId" UUID,
    "surface" TEXT NOT NULL,
    "itemIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "disclosures" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_rank_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feed_rank_snapshots_createdAt_idx" ON "feed_rank_snapshots"("createdAt");
