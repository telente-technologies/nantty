export interface GetFollowingFeedQuery {
  readonly viewerId: string;
  readonly kinds: readonly ("post" | "clip")[];
  readonly cursor: string | undefined;
  readonly limit: number;
}
