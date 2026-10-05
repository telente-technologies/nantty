export interface ListFollowedStoresQuery {
  readonly viewerId: string | undefined;
  readonly ownerId: string;
  readonly cursor: string | undefined;
  readonly limit: number;
}
