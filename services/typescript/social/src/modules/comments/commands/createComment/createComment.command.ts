import type { MentionEntity } from "../../../mentions/models/mention.model.js";

export interface CreateCommentCommand {
  readonly authorId: string;
  readonly postId: string;
  readonly text: string;
  readonly parentCommentId: string | undefined;
  readonly mentions: readonly MentionEntity[] | undefined;
}
