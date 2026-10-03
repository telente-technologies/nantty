export interface SharePostCommand {
  readonly actorId: string | undefined;
  readonly postId: string;
  readonly channel: string;
}
