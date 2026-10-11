export interface GetStoreConversationQuery {
  readonly storeId: string;
  readonly conversationId: string;
  readonly viewerId: string;
  readonly cursor: string | undefined;
  readonly after: string | undefined;
  readonly limit: number;
}
