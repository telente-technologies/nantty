export type PostKind = "post" | "clip" | "story";
export type MediaType = "image" | "video";
export type CounterField = "likeCount" | "commentCount" | "repostCount" | "shareCount" | "viewCount";

export interface PostMedia {
  readonly url: string;
  readonly type: MediaType;
  readonly mediaId?: string;
  readonly posterUrl?: string;
  readonly width?: number;
  readonly height?: number;
  readonly blurhash?: string;
}

export interface PostRecord {
  readonly id: string;
  readonly authorId: string;
  readonly storeId: string | null;
  readonly kind: PostKind;
  readonly text: string;
  readonly media: readonly PostMedia[];
  readonly audience: "everyone";
  readonly topics: readonly string[];
  readonly productIds: readonly string[];
  readonly repostOfId: string | null;
  readonly likeCount: number;
  readonly commentCount: number;
  readonly repostCount: number;
  readonly shareCount: number;
  readonly viewCount: number;
  readonly expiresAt: Date | null;
  readonly deletedAt: Date | null;
  readonly createdAt: Date;
}

export interface NewPostInput {
  readonly authorId: string;
  readonly storeId: string | null;
  readonly kind: PostKind;
  readonly text: string;
  readonly media: readonly PostMedia[];
  readonly topics: readonly string[];
  readonly productIds: readonly string[];
  readonly repostOfId: string | null;
  readonly expiresAt: Date | null;
  readonly createdAt: Date;
}

export interface PostListFilter {
  readonly authorIds?: readonly string[];
  readonly storeIds?: readonly string[];
  readonly kinds?: readonly PostKind[];
  readonly topic?: string;
  readonly excludeAuthorIds?: readonly string[];
  readonly createdAfter?: Date;
}

export interface CommentRecord {
  readonly id: string;
  readonly postId: string;
  readonly authorId: string;
  readonly parentCommentId: string | null;
  readonly rootCommentId: string | null;
  readonly text: string;
  readonly likeCount: number;
  readonly replyCount: number;
  readonly deletedAt: Date | null;
  readonly createdAt: Date;
}

export type LiveStatus = "live" | "ended";

export interface LiveSessionRecord {
  readonly id: string;
  readonly hostId: string;
  readonly storeId: string | null;
  readonly title: string;
  readonly status: LiveStatus;
  readonly viewerCount: number;
  readonly reactionCount: number;
  readonly productIds: readonly string[];
  readonly pinnedProductId: string | null;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
}

export interface LiveCommentRecord {
  readonly id: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly text: string;
  readonly createdAt: Date;
}
