export interface ListStoreConversationsQuery {
  readonly storeId: string;
  readonly filter: "all" | "unread" | "orders";
  readonly text: string | undefined;
  readonly cursor: string | undefined;
  readonly limit: number;
}
