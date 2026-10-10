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
