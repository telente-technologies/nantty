export interface ListAudienceFollowersQuery {
  readonly accountId: string;
  readonly cursor: string | undefined;
  readonly limit: number;
}
