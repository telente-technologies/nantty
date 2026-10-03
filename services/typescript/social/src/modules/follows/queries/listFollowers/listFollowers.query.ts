export interface ListFollowersQuery {
  readonly viewerId: string | undefined;
  readonly ownerId: string;
  readonly searchTerm: string | undefined;
  readonly cursor: string | undefined;
  readonly limit: number;
}
