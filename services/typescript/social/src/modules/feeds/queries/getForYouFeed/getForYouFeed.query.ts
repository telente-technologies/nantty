export interface GetForYouFeedQuery {
  readonly viewerId: string | undefined;
  readonly cursor: string | undefined;
  readonly limit: number;
}
