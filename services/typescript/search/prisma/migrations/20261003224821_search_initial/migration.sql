-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateTable
CREATE TABLE "documents" (
    "kind" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "doc_key" TEXT NOT NULL,
    "owner_account_id" TEXT,
    "title" TEXT NOT NULL,
    "title_normalized" TEXT NOT NULL,
    "subtitle" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "tags_text" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[],
    "summary" JSONB NOT NULL,
    "visibility" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL,
    "popularity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "region" TEXT,
    "version" BIGINT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tsv" tsvector,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("kind","entity_id")
);

-- CreateTable
CREATE TABLE "account_states" (
    "account_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "version" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_states_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "blocker_id" TEXT NOT NULL,
    "blocked_id" TEXT NOT NULL,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("blocker_id","blocked_id")
);

-- CreateTable
CREATE TABLE "follows" (
    "follower_id" TEXT NOT NULL,
    "followee_id" TEXT NOT NULL,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id","followee_id")
);

-- CreateTable
CREATE TABLE "consents" (
    "account_id" TEXT NOT NULL,
    "consent_type" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("account_id","consent_type")
);

-- CreateTable
CREATE TABLE "processed_events" (
    "event_id" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "recent_searches" (
    "id" UUID NOT NULL,
    "account_id" TEXT NOT NULL,
    "query_normalized" TEXT NOT NULL,
    "query_display" TEXT NOT NULL,
    "searched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recent_searches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_tsv_idx" ON "documents" USING GIN ("tsv");

-- CreateIndex
CREATE INDEX "documents_title_normalized_idx" ON "documents" USING GIN ("title_normalized" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "documents_owner_account_id_idx" ON "documents"("owner_account_id");

-- CreateIndex
CREATE INDEX "documents_tags_idx" ON "documents" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "blocks_blocked_id_idx" ON "blocks"("blocked_id");

-- CreateIndex
CREATE INDEX "follows_followee_id_idx" ON "follows"("followee_id");

-- CreateIndex
CREATE INDEX "recent_searches_account_id_searched_at_idx" ON "recent_searches"("account_id", "searched_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "recent_searches_account_id_query_normalized_key" ON "recent_searches"("account_id", "query_normalized");
