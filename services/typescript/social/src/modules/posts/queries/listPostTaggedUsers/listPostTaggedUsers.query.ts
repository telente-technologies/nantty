export interface ListPostTaggedUsersQuery {
  readonly viewerId: string | undefined;
  readonly postId: string;
  readonly cursor: string | undefined;
  readonly limit: number;
}
