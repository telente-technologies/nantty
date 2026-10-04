export interface GetPostConversationQuery {
  readonly viewerId: string | undefined;
  readonly postId: string;
  readonly sort: "top" | "latest";
  readonly cursor: string | undefined;
  readonly limit: number;
}
