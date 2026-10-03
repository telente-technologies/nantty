export interface ListMessagesQuery {
  readonly viewerId: string;
  readonly conversationId: string;
  readonly cursor: string | undefined;
  readonly after: string | undefined;
  readonly limit: number;
}
