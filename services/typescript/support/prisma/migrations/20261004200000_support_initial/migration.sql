-- CreateTable
CREATE TABLE "help_categories" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "icon_name" TEXT NOT NULL DEFAULT 'question',
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_topics" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "body_markdown" TEXT NOT NULL,
    "tags" TEXT[],
    "search_text" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "origin" TEXT NOT NULL DEFAULT 'editorial',
    "source_ticket_id" UUID,
    "merged_into_topic_id" UUID,
    "seed_key" TEXT,
    "seed_hash" TEXT,
    "edited_by_staff" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "not_helpful_count" INTEGER NOT NULL DEFAULT 0,
    "related_questions" INTEGER NOT NULL DEFAULT 0,
    "updated_by_name" TEXT NOT NULL DEFAULT 'Nantty',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_topic_versions" (
    "id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body_markdown" TEXT NOT NULL,
    "tags" TEXT[],
    "edited_by_name" TEXT NOT NULL,
    "change_note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_topic_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_topic_relations" (
    "topic_id" UUID NOT NULL,
    "related_topic_id" UUID NOT NULL,

    CONSTRAINT "help_topic_relations_pkey" PRIMARY KEY ("topic_id","related_topic_id")
);

-- CreateTable
CREATE TABLE "help_topic_votes" (
    "topic_id" UUID NOT NULL,
    "voter_key" TEXT NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_topic_votes_pkey" PRIMARY KEY ("topic_id","voter_key")
);

-- CreateTable
CREATE TABLE "auto_topic_logs" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "ticket_ref" TEXT NOT NULL,
    "topic_id" UUID,
    "action" TEXT NOT NULL,
    "similarity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "writer" TEXT NOT NULL DEFAULT 'template',
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auto_topic_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" TEXT NOT NULL DEFAULT 'system',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "requester_account_id" UUID NOT NULL,
    "requester_name" TEXT NOT NULL,
    "requester_username" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'form',
    "linked_kind" TEXT,
    "linked_id" TEXT,
    "linked_label" TEXT,
    "assignee_staff_id" TEXT,
    "assignee_name" TEXT,
    "first_response_due_at" TIMESTAMP(3) NOT NULL,
    "first_responded_at" TIMESTAMP(3),
    "resolution_due_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "satisfaction_score" INTEGER,
    "satisfaction_comment" TEXT,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_preview" TEXT NOT NULL DEFAULT '',
    "requester_unread" INTEGER NOT NULL DEFAULT 0,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "auto_faq_status" TEXT NOT NULL DEFAULT 'none',
    "auto_faq_locked_until" TIMESTAMP(3),
    "idempotency_key" TEXT,
    "anonymized_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "author_kind" TEXT NOT NULL,
    "author_id" TEXT,
    "author_name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_events" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_name" TEXT NOT NULL,
    "reason" TEXT,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "macros" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT,
    "updated_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "macros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "staff_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "can_answer" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("staff_id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_until" TIMESTAMP(3),
    "lock_token" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_events" (
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "help_categories_slug_key" ON "help_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "help_topics_seed_key_key" ON "help_topics"("seed_key");

-- CreateIndex
CREATE INDEX "help_topics_category_id_status_idx" ON "help_topics"("category_id", "status");

-- CreateIndex
CREATE INDEX "help_topics_status_origin_idx" ON "help_topics"("status", "origin");

-- CreateIndex
CREATE INDEX "help_topics_tags_idx" ON "help_topics" USING GIN ("tags");

-- CreateIndex
CREATE UNIQUE INDEX "help_topics_slug_locale_key" ON "help_topics"("slug", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "help_topic_versions_topic_id_version_key" ON "help_topic_versions"("topic_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "auto_topic_logs_ticket_id_key" ON "auto_topic_logs"("ticket_id");

-- CreateIndex
CREATE INDEX "auto_topic_logs_created_at_idx" ON "auto_topic_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_number_key" ON "tickets"("number");

-- CreateIndex
CREATE INDEX "tickets_requester_account_id_updated_at_idx" ON "tickets"("requester_account_id", "updated_at");

-- CreateIndex
CREATE INDEX "tickets_status_priority_idx" ON "tickets"("status", "priority");

-- CreateIndex
CREATE INDEX "tickets_assignee_staff_id_status_idx" ON "tickets"("assignee_staff_id", "status");

-- CreateIndex
CREATE INDEX "tickets_auto_faq_status_idx" ON "tickets"("auto_faq_status");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_requester_account_id_idempotency_key_key" ON "tickets"("requester_account_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "ticket_messages_ticket_id_created_at_idx" ON "ticket_messages"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "ticket_events_ticket_id_created_at_idx" ON "ticket_events"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_created_at_idx" ON "outbox_events"("published_at", "created_at");

-- CreateIndex
CREATE INDEX "processed_events_processed_at_idx" ON "processed_events"("processed_at");

-- AddForeignKey
ALTER TABLE "help_topics" ADD CONSTRAINT "help_topics_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "help_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_topic_versions" ADD CONSTRAINT "help_topic_versions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "help_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_topic_relations" ADD CONSTRAINT "help_topic_relations_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "help_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_topic_relations" ADD CONSTRAINT "help_topic_relations_related_topic_id_fkey" FOREIGN KEY ("related_topic_id") REFERENCES "help_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_topic_votes" ADD CONSTRAINT "help_topic_votes_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "help_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

