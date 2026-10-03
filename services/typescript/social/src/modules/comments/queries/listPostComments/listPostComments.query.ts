export interface ListPostCommentsQuery {
  readonly viewerId: string | undefined;
  readonly postId: string;
  readonly cursor: string | undefined;
  readonly limit: number;
}
