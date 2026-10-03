export interface ListFollowRequestsQuery {
  readonly followeeId: string;
  readonly cursor: string | undefined;
  readonly limit: number;
}
