export interface GetPostConversationQuery {
  readonly viewerId: string | undefined;
  readonly postId: string;
  readonly sort: "relevant" | "latest" | "likes" | "top";
  readonly cursor: string | undefined;
  readonly limit: number;
}
