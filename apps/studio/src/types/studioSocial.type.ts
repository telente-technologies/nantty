import type { ID, ISODate } from "./index";
import type { PersonSummary } from "./audience.type";

export interface PostComment {
  readonly id: ID;
  readonly postId: ID;
  readonly parentCommentId: ID | null;
  readonly author: PersonSummary;
  readonly text: string;
  readonly createdAt: ISODate;
  readonly likes: number;
  readonly replyCount: number;
  readonly isPinned: boolean;
  readonly isPostAuthor: boolean;
}

export type MyPostCommentsFilter = "all" | "needs_reply" | "pinned" | "hidden";

export interface MyPostSummary {
  readonly id: ID;
  readonly kind: string;
  readonly text: string;
  readonly thumbnailUrl: string | null;
}

export interface MyPostComment extends PostComment {
  readonly previewReplies: readonly PostComment[];
  readonly post: MyPostSummary;
  readonly hidden: boolean;
  readonly hiddenAt: ISODate | null;
  readonly needsReply: boolean;
}

export interface CommentHiddenState {
  readonly commentId: ID;
  readonly postId: ID;
  readonly hidden: boolean;
  readonly hiddenAt: ISODate | null;
}

export type NotificationCategory = "auth" | "orders" | "escrow" | "seller" | "payments" | "creator" | "checkmarks" | "social" | "milestones" | "live" | "trust" | "privacy" | "support" | "marketing";

export interface NotificationPreference {
  readonly category: NotificationCategory;
  readonly push: boolean;
  readonly email: boolean;
  readonly locked: boolean;
}

export type WhoCanMention = "everyone" | "following" | "no_one";
export type WhoCanMessage = "everyone" | "following" | "followers" | "nobody";

export interface ContactPrivacy {
  readonly whoCanMessageMe: WhoCanMessage;
  readonly whoCanMentionMe: WhoCanMention;
}
