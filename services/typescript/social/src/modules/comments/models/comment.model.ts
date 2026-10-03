import type { UserSummary } from "../../../interfaces/identityDirectory.interface.js";
import type { MentionEntity } from "../../mentions/models/mention.model.js";

export interface CommentVideoReply {
  readonly clipId: string;
  readonly thumbnailUrl: string | null;
  readonly createdAt: string;
}

export interface CommentView {
  readonly id: string;
  readonly postId: string;
  readonly parentCommentId: string | null;
  readonly rootCommentId: string | null;
  readonly author: UserSummary;
  readonly text: string;
  readonly createdAt: string;
  readonly likes: number;
  readonly liked: boolean;
  readonly replyCount: number;
  readonly replyingTo?: { readonly userId: string; readonly username: string };
  readonly mentions: readonly MentionEntity[];
  readonly videoReplies: readonly CommentVideoReply[];
  readonly videoReplyBlocked: boolean;
}

export interface CommentWithReplies extends CommentView {
  readonly previewReplies: readonly CommentView[];
}
