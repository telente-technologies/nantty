export interface ListCommentRepliesQuery {
  readonly viewerId: string | undefined;
  readonly commentId: string;
  readonly cursor: string | undefined;
  readonly limit: number;
}
