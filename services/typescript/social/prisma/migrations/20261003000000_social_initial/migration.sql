-- CreateEnum
CREATE TYPE "ConversationKind" AS ENUM ('direct', 'group', 'channel', 'business');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('owner', 'admin', 'member', 'subscriber');

-- CreateEnum
CREATE TYPE "InboxFolder" AS ENUM ('chats', 'requests', 'spam');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('text', 'voice', 'image', 'video', 'system', 'shared', 'location', 'liveLocation', 'document', 'poll');

-- CreateEnum
CREATE TYPE "MessageRequestAudience" AS ENUM ('everyone', 'following', 'followers', 'nobody');

-- CreateEnum
CREATE TYPE "PostKind" AS ENUM ('post', 'clip', 'story');

-- CreateEnum
CREATE TYPE "PostAudience" AS ENUM ('everyone', 'followers');

-- CreateEnum
CREATE TYPE "PostVisibility" AS ENUM ('public', 'subscribers');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('image', 'video');

-- CreateEnum
CREATE TYPE "SoundStatus" AS ENUM ('available', 'under_copyright_review', 'removed');

-- CreateEnum
CREATE TYPE "FollowState" AS ENUM ('requested', 'accepted', 'rejected');

-- CreateEnum
CREATE TYPE "SavedItemType" AS ENUM ('post', 'video', 'clip', 'product');

-- CreateEnum
CREATE TYPE "StreakState" AS ENUM ('none', 'active', 'broken');

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "kind" "ConversationKind" NOT NULL,
    "directKey" TEXT,
    "title" TEXT,
    "photoMediaId" UUID,
    "createdById" UUID NOT NULL,
    "storeId" TEXT,
    "disappearingMessagesSeconds" INTEGER,
    "onlyAdminsCanMentionAll" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageKind" "MessageKind",
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_members" (
    "conversationId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'member',
    "inboxFolder" "InboxFolder" NOT NULL DEFAULT 'chats',
    "spamReason" TEXT,
    "spamScore" DOUBLE PRECISION,
    "restricted" BOOLEAN NOT NULL DEFAULT false,
    "mutedUntil" TIMESTAMP(3),
    "mutedAlways" BOOLEAN NOT NULL DEFAULT false,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "lastReadAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("conversationId","accountId")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "kind" "MessageKind" NOT NULL,
    "clientMessageId" TEXT,
    "ciphertext" TEXT,
    "deviceId" TEXT,
    "protocol" TEXT NOT NULL DEFAULT 'signal-v1-pending',
    "mediaId" UUID,
    "mediaType" TEXT,
    "mediaUrl" TEXT,
    "mediaDurationSeconds" INTEGER,
    "linkPreviewEnvelope" TEXT,
    "sharedContent" JSONB,
    "location" JSONB,
    "document" JSONB,
    "mentions" JSONB NOT NULL DEFAULT '[]',
    "expiresAt" TIMESTAMP(3),
    "mediaExpiresAt" TIMESTAMP(3),
    "mediaPurgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pollQuestion" TEXT,
    "pollAllowMultiple" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_reactions" (
    "messageId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("messageId","userId","emoji")
);

-- CreateTable
CREATE TABLE "message_poll_options" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "message_poll_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_poll_votes" (
    "optionId" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_poll_votes_pkey" PRIMARY KEY ("optionId","userId")
);

-- CreateTable
CREATE TABLE "chat_settings" (
    "accountId" UUID NOT NULL,
    "messageRequestsFrom" "MessageRequestAudience" NOT NULL DEFAULT 'everyone',
    "notifyMessages" BOOLEAN NOT NULL DEFAULT true,
    "notifyRequests" BOOLEAN NOT NULL DEFAULT true,
    "notifyGroups" BOOLEAN NOT NULL DEFAULT true,
    "notifyStreakReminders" BOOLEAN NOT NULL DEFAULT true,
    "showMessagePreview" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "timezoneChangedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_settings_pkey" PRIMARY KEY ("accountId")
);

-- CreateTable
CREATE TABLE "sender_behaviour_metrics" (
    "accountId" UUID NOT NULL,
    "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientsInWindow" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sender_behaviour_metrics_pkey" PRIMARY KEY ("accountId")
);

-- CreateTable
CREATE TABLE "chat_media_expiry_runs" (
    "id" UUID NOT NULL,
    "purgedCount" INTEGER NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_media_expiry_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "kind" "PostKind" NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "audience" "PostAudience" NOT NULL DEFAULT 'everyone',
    "visibility" "PostVisibility" NOT NULL DEFAULT 'public',
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "soundId" UUID,
    "resharedFromId" UUID,
    "replyToCommentId" UUID,
    "replyToClipId" UUID,
    "replyToCommenterId" UUID,
    "stickerLayout" JSONB,
    "mentions" JSONB NOT NULL DEFAULT '[]',
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "repostCount" INTEGER NOT NULL DEFAULT 0,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "profileVisitCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_media" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "type" "MediaKind" NOT NULL,
    "url" TEXT,
    "posterUrl" TEXT,
    "hlsUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "durationSeconds" INTEGER,
    "blurhash" TEXT,

    CONSTRAINT "post_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_likes" (
    "postId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_likes_pkey" PRIMARY KEY ("postId","userId")
);

-- CreateTable
CREATE TABLE "post_shares" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'link',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "parentCommentId" UUID,
    "rootCommentId" UUID,
    "authorId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "mentions" JSONB NOT NULL DEFAULT '[]',
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_likes" (
    "commentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("commentId","userId")
);

-- CreateTable
CREATE TABLE "feed_feedback" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_views" (
    "storyId" UUID NOT NULL,
    "viewerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_views_pkey" PRIMARY KEY ("storyId","viewerId")
);

-- CreateTable
CREATE TABLE "post_viewers" (
    "postId" UUID NOT NULL,
    "viewerKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_viewers_pkey" PRIMARY KEY ("postId","viewerKey")
);

-- CreateTable
CREATE TABLE "post_daily_stats" (
    "postId" UUID NOT NULL,
    "day" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "post_daily_stats_pkey" PRIMARY KEY ("postId","day")
);

-- CreateTable
CREATE TABLE "sounds" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "isOriginal" BOOLEAN NOT NULL DEFAULT true,
    "allowReuse" BOOLEAN NOT NULL DEFAULT true,
    "status" "SoundStatus" NOT NULL DEFAULT 'available',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "audioUrl" TEXT,
    "coverUrl" TEXT,
    "sourceClipId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sound_saves" (
    "soundId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sound_saves_pkey" PRIMARY KEY ("soundId","userId")
);

-- CreateTable
CREATE TABLE "follows" (
    "id" UUID NOT NULL,
    "followerId" UUID NOT NULL,
    "followeeId" UUID NOT NULL,
    "state" "FollowState" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "blockerId" UUID NOT NULL,
    "blockedId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("blockerId","blockedId")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "lockToken" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "accountId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "requestPath" TEXT NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "responseBody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("accountId","key")
);

-- CreateTable
CREATE TABLE "report_intakes" (
    "id" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "evidenceHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_intakes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "save_collections" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "save_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_items" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "SavedItemType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "collectionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_streaks" (
    "conversationId" UUID NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "state" "StreakState" NOT NULL DEFAULT 'none',
    "lastCompletedDay" TEXT,
    "countBeforeBreak" INTEGER NOT NULL DEFAULT 0,
    "brokenAt" TIMESTAMP(3),
    "restorableUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_streaks_pkey" PRIMARY KEY ("conversationId")
);

-- CreateTable
CREATE TABLE "streak_sender_days" (
    "conversationId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "localDay" TEXT NOT NULL,
    "firstSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "streak_sender_days_pkey" PRIMARY KEY ("conversationId","accountId","localDay")
);

-- CreateTable
CREATE TABLE "streak_restores" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "monthKey" TEXT NOT NULL,
    "restoredCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "streak_restores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streak_celebrations" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "days" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "celebratedAt" TIMESTAMP(3),

    CONSTRAINT "streak_celebrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversations_directKey_key" ON "conversations"("directKey");

-- CreateIndex
CREATE INDEX "conversations_lastMessageAt_idx" ON "conversations"("lastMessageAt");

-- CreateIndex
CREATE INDEX "conversation_members_accountId_inboxFolder_leftAt_idx" ON "conversation_members"("accountId", "inboxFolder", "leftAt");

-- CreateIndex
CREATE INDEX "messages_conversationId_id_idx" ON "messages"("conversationId", "id");

-- CreateIndex
CREATE INDEX "messages_mediaExpiresAt_mediaPurgedAt_idx" ON "messages"("mediaExpiresAt", "mediaPurgedAt");

-- CreateIndex
CREATE INDEX "messages_expiresAt_idx" ON "messages"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "messages_conversationId_senderId_clientMessageId_key" ON "messages"("conversationId", "senderId", "clientMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "message_poll_options_messageId_position_key" ON "message_poll_options"("messageId", "position");

-- CreateIndex
CREATE INDEX "message_poll_votes_messageId_userId_idx" ON "message_poll_votes"("messageId", "userId");

-- CreateIndex
CREATE INDEX "posts_authorId_id_idx" ON "posts"("authorId", "id");

-- CreateIndex
CREATE INDEX "posts_kind_id_idx" ON "posts"("kind", "id");

-- CreateIndex
CREATE INDEX "posts_kind_createdAt_likeCount_idx" ON "posts"("kind", "createdAt", "likeCount");

-- CreateIndex
CREATE INDEX "posts_resharedFromId_idx" ON "posts"("resharedFromId");

-- CreateIndex
CREATE INDEX "posts_replyToCommentId_idx" ON "posts"("replyToCommentId");

-- CreateIndex
CREATE INDEX "post_media_mediaId_idx" ON "post_media"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "post_media_postId_position_key" ON "post_media"("postId", "position");

-- CreateIndex
CREATE INDEX "post_likes_userId_createdAt_idx" ON "post_likes"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "post_shares_postId_idx" ON "post_shares"("postId");

-- CreateIndex
CREATE INDEX "comments_postId_parentCommentId_id_idx" ON "comments"("postId", "parentCommentId", "id");

-- CreateIndex
CREATE INDEX "comments_rootCommentId_id_idx" ON "comments"("rootCommentId", "id");

-- CreateIndex
CREATE INDEX "comments_authorId_idx" ON "comments"("authorId");

-- CreateIndex
CREATE INDEX "feed_feedback_userId_createdAt_idx" ON "feed_feedback"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "feed_feedback_postId_idx" ON "feed_feedback"("postId");

-- CreateIndex
CREATE INDEX "sounds_ownerId_idx" ON "sounds"("ownerId");

-- CreateIndex
CREATE INDEX "sounds_status_usageCount_idx" ON "sounds"("status", "usageCount");

-- CreateIndex
CREATE INDEX "sound_saves_userId_createdAt_idx" ON "sound_saves"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "follows_followeeId_state_id_idx" ON "follows"("followeeId", "state", "id");

-- CreateIndex
CREATE INDEX "follows_followerId_state_id_idx" ON "follows"("followerId", "state", "id");

-- CreateIndex
CREATE UNIQUE INDEX "follows_followerId_followeeId_key" ON "follows"("followerId", "followeeId");

-- CreateIndex
CREATE INDEX "blocks_blockedId_idx" ON "blocks"("blockedId");

-- CreateIndex
CREATE INDEX "outbox_events_publishedAt_createdAt_idx" ON "outbox_events"("publishedAt", "createdAt");

-- CreateIndex
CREATE INDEX "idempotency_records_createdAt_idx" ON "idempotency_records"("createdAt");

-- CreateIndex
CREATE INDEX "report_intakes_reporterId_createdAt_idx" ON "report_intakes"("reporterId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "save_collections_userId_name_key" ON "save_collections"("userId", "name");

-- CreateIndex
CREATE INDEX "saved_items_userId_id_idx" ON "saved_items"("userId", "id");

-- CreateIndex
CREATE INDEX "saved_items_userId_type_id_idx" ON "saved_items"("userId", "type", "id");

-- CreateIndex
CREATE INDEX "saved_items_userId_collectionId_id_idx" ON "saved_items"("userId", "collectionId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_items_userId_type_targetId_key" ON "saved_items"("userId", "type", "targetId");

-- CreateIndex
CREATE INDEX "streak_restores_accountId_monthKey_idx" ON "streak_restores"("accountId", "monthKey");

-- CreateIndex
CREATE INDEX "streak_celebrations_conversationId_accountId_celebratedAt_idx" ON "streak_celebrations"("conversationId", "accountId", "celebratedAt");

-- AddForeignKey
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_poll_options" ADD CONSTRAINT "message_poll_options_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_poll_votes" ADD CONSTRAINT "message_poll_votes_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "message_poll_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_resharedFromId_fkey" FOREIGN KEY ("resharedFromId") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sound_saves" ADD CONSTRAINT "sound_saves_soundId_fkey" FOREIGN KEY ("soundId") REFERENCES "sounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "save_collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_streaks" ADD CONSTRAINT "chat_streaks_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streak_sender_days" ADD CONSTRAINT "streak_sender_days_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_streaks"("conversationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streak_restores" ADD CONSTRAINT "streak_restores_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_streaks"("conversationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streak_celebrations" ADD CONSTRAINT "streak_celebrations_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_streaks"("conversationId") ON DELETE CASCADE ON UPDATE CASCADE;

