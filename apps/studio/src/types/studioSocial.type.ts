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

export interface PostCommentThread extends PostComment {
  readonly type: "comment";
  readonly previewReplies: readonly PostComment[];
}

export interface PostQuoteItem {
  readonly type: "quote";
  readonly id: ID;
}

export type PostCommentsItem = PostCommentThread | PostQuoteItem;

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
