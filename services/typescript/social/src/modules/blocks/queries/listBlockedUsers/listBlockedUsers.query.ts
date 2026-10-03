export interface ListBlockedUsersQuery {
  readonly viewerId: string;
  readonly cursor: string | undefined;
  readonly limit: number;
}
