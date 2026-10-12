import type { CommentView } from "./comment.model.js";

export type MyPostCommentsFilter = "all" | "needs_reply" | "pinned" | "hidden";

export interface MyPostSummary {
  readonly id: string;
  readonly kind: string;
  readonly text: string;
  readonly thumbnailUrl: string | null;
}

export interface MyPostCommentItem extends CommentView {
  readonly previewReplies: readonly CommentView[];
  readonly post: MyPostSummary;
  readonly hidden: boolean;
  readonly hiddenAt: string | null;
  readonly needsReply: boolean;
}
