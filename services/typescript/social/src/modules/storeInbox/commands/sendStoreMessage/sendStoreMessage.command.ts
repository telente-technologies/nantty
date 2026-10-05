export interface SendStoreMessageCommand {
  readonly storeId: string;
  readonly conversationId: string;
  readonly senderId: string;
  readonly senderLabel: string | null;
  readonly actorName: string;
  readonly body: string;
}
