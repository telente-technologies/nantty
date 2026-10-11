import type { OutgoingMessageInput } from "../../../messages/services/messageValidation.service.js";

export interface SendStoreMessageCommand {
  readonly storeId: string;
  readonly conversationId: string;
  readonly senderAccountId: string;
  readonly senderLabel: string;
  readonly idempotencyKey: string | undefined;
  readonly message: OutgoingMessageInput;
}
