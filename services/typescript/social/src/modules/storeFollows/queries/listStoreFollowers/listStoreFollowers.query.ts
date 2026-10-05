export interface ListStoreFollowersQuery {
  readonly viewerId: string | undefined;
  readonly storeId: string;
  readonly cursor: string | undefined;
  readonly limit: number;
}
