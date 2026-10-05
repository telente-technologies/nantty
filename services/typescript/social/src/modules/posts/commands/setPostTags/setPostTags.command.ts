export interface SetPostTagsCommand {
  readonly actorId: string;
  readonly postId: string;
  readonly taggedUserIds: readonly string[];
}
