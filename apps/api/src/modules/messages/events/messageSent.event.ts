import { defineEvent } from "@zudojs/events";

export interface MessageSentPayload {
  readonly conversationId: string;
  readonly messageId: string;
  readonly senderId: string;
  readonly recipientIds: readonly string[];
}

export const MessageSentEvent = defineEvent<"messages.messageSent", MessageSentPayload>("messages.messageSent");
