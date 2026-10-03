export interface GetPopularFeedQuery {
  readonly viewerId: string | undefined;
  readonly cursor: string | undefined;
  readonly limit: number;
}
