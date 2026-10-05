export interface SetPostProductsCommand {
  readonly actorId: string;
  readonly postId: string;
  readonly productIds: readonly string[];
}
