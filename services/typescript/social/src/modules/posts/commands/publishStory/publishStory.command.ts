export interface PublishStoryCommand {
  readonly authorId: string;
  readonly mediaId: string;
  readonly soundId?: string | undefined;
  readonly look?: string | undefined;
}
