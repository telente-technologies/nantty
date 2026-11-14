ALTER TABLE "chat_settings"
  ADD COLUMN "notifyMessageSound" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyMessageVibration" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyMessageBubbles" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "messageBubbleMode" VARCHAR(12) NOT NULL DEFAULT 'selected',
  ADD COLUMN "messageBubbleConversationIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "messageBubbleExcludedConversationIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
