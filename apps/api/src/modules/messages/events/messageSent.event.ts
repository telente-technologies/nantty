import { defineEvent } from "@zudojs/events";

import type { ConversationKind } from "../models/messages.model.js";

export interface MessageSentPayload {
  readonly conversationId: string;
  readonly conversationKind: ConversationKind;
  readonly messageId: string;
  readonly senderId: string;
  readonly recipientIds: readonly string[];
}

export const MessageSentEvent = defineEvent<"messages.messageSent", MessageSentPayload>("messages.messageSent");
