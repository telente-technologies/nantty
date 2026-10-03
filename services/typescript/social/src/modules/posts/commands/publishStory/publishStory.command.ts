import type { MediaReferenceInput } from "../createPost/createPost.command.js";

export interface PublishStoryCommand {
  readonly authorId: string;
  readonly mediaId: string;
  readonly media: MediaReferenceInput;
}
