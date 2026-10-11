export interface ListStoreConversationsQuery {
  readonly storeId: string;
  readonly filter: "all" | "unread" | "orders";
  readonly cursor: string | undefined;
  readonly limit: number;
}
