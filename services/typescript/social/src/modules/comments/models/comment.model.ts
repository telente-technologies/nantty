import type { UserSummary } from "../../../interfaces/identityDirectory.interface.js";
import type { CheckmarkColor } from "../../../interfaces/identityDirectory.interface.js";
import type { MentionEntity } from "../../mentions/models/mention.model.js";
import type { QuotedPostSummary } from "../../posts/models/post.model.js";

export interface CommentVideoReply {
  readonly clipId: string;
  readonly thumbnailUrl: string | null;
  readonly createdAt: string;
}

export interface CommentAuthorProfile {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly handle: string;
  readonly avatarUrl: string | null;
  readonly checkmark: CheckmarkColor | null;
}

export interface CommentView {
  readonly id: string;
  readonly postId: string;
  readonly parentCommentId: string | null;
  readonly rootCommentId: string | null;
  readonly author: UserSummary;
  readonly postedAs?: CommentAuthorProfile | null;
  readonly text: string;
  readonly createdAt: string;
  readonly likes: number;
  readonly liked: boolean;
  readonly bookmarked: boolean;
  readonly replyCount: number;
  readonly depth: number;
  readonly isPinned: boolean;
  readonly pinnedAt: string | null;
  readonly replyingTo?: { readonly userId: string; readonly username: string };
  readonly mentions: readonly MentionEntity[];
  readonly videoReplies: readonly CommentVideoReply[];
  readonly videoReplyBlocked: boolean;
  readonly isPostAuthor: boolean;
  readonly quotedPost: QuotedPostSummary | null;
  readonly quotedPostUnavailable: boolean;
}

export interface CommentHiddenState {
  readonly commentId: string;
  readonly postId: string;
  readonly hidden: boolean;
  readonly hiddenAt: string | null;
}

export interface CommentWithReplies extends CommentView {
  readonly previewReplies: readonly CommentView[];
}

export interface ThreadConnector {
  readonly depth: number;
  readonly hasParentAbove: boolean;
  readonly hasChildBelow: boolean;
  readonly isLastInChain: boolean;
}

export interface ThreadReplyView extends CommentView {
  readonly isPostAuthor: boolean;
  readonly connector: ThreadConnector;
  readonly inlineReplies: readonly ThreadReplyView[];
  readonly hasMoreReplies: boolean;
  readonly continuesInThread: boolean;
}

export interface CommentThreadPage {
  readonly data: readonly ThreadReplyView[];
  readonly nextCursor: string | null;
  readonly focus: CommentView;
  readonly ancestors: readonly CommentView[];
  readonly maximumVisibleDepth: number;
}

export interface QuoteThreadItem {
  readonly type: "quote";
  readonly id: string;
  readonly postId: string;
  readonly quotePost: QuotedPostSummary;
  readonly likes: number;
  readonly commentCount: number;
  readonly isPostAuthor: boolean;
  readonly createdAt: string;
}

export type ConversationFilter = "all" | "quotes";
export type RankedCommentItem = CommentWithReplies & { readonly type: "comment" };
export type RankedThreadItem = ThreadReplyView & { readonly type: "comment" };
