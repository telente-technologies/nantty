export interface QuotedPostThumbnailContract {
  readonly type: "image" | "video";
  readonly url: string;
  readonly blurhash: string | null;
}

export interface QuotedPostSummaryContract {
  readonly id: string;
  readonly kind: "post" | "clip";
  readonly author: { readonly id: string; readonly name: string; readonly username: string; readonly avatarUrl: string | null; readonly verified: boolean };
  readonly text: string;
  readonly thumbnail: QuotedPostThumbnailContract | null;
  readonly mediaCount: number;
  readonly createdAt: string;
}

export interface CreatePostQuoteFieldsContract {
  readonly quotedPostId?: string | null;
}

export interface CreateCommentBodyContract {
  readonly text: string;
  readonly parentCommentId?: string;
  readonly quotedPostId?: string | null;
}

export interface CommentQuoteFieldsContract {
  readonly isPostAuthor: boolean;
  readonly quotedPost: QuotedPostSummaryContract | null;
  readonly quotedPostUnavailable: boolean;
}

export const postLinkHostsContract: readonly string[] = ["zudomart.com", "www.zudomart.com", "app.zudomart.com", "zudomart.app", "www.zudomart.app"];
export const postLinkPathKindsContract: readonly string[] = ["post", "posts", "clip", "clips"];

export interface PostNotificationMuteContract {
  readonly postId: string;
  readonly muted: boolean;
}

export const postNotificationMutePathContract = "/api/v1/posts/:postId/notifications-mute";

export interface PostVideoAnalyticsContract {
  readonly views: number;
  readonly watchTimeSeconds: number;
  readonly averageWatchSeconds: number;
  readonly completedViews: number;
  readonly completionRate: number;
}

export const postAnalyticsPathContract = "/api/v1/posts/:postId/analytics";

export type CommentSectionFilterContract = "all" | "quotes";

export interface QuoteThreadItemContract {
  readonly type: "quote";
  readonly id: string;
  readonly postId: string;
  readonly quotePost: QuotedPostSummaryContract;
  readonly likes: number;
  readonly commentCount: number;
  readonly isPostAuthor: boolean;
  readonly createdAt: string;
}

export const commentSectionPathsContract = { comments: "/api/v1/posts/:postId/comments", thread: "/api/v1/posts/:postId/thread" } as const;
export const commentSectionFilterQueryContract = "filter";

export interface RepostStateContract {
  readonly reposts: number;
  readonly reposted: boolean;
}

export const repostPathContract = "/api/v1/posts/:postId/repost";
