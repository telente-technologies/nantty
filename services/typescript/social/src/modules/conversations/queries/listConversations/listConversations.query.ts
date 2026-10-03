export interface ListConversationsQuery {
  readonly viewerId: string;
  readonly folder: "chats" | "requests" | "spam";
  readonly filter: "all" | "direct";
  readonly cursor: string | undefined;
  readonly limit: number;
}
