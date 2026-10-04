export interface PostSearchSource {
  readonly postId: string;
  readonly authorId: string;
  readonly kind: "post" | "clip" | "story";
  readonly caption: string;
  readonly hashtags: readonly string[];
  readonly audience: "everyone" | "followers";
  readonly visibility: "public" | "subscribers";
  readonly thumbnailUrl: string | null;
  readonly soundTitle: string | null;
  readonly likeCount: number;
  readonly viewCount: number;
  readonly saveCount: number;
  readonly removed: boolean;
  readonly sensitiveLabels: readonly string[];
  readonly createdAt: string;
}

export interface SoundSearchSource {
  readonly soundId: string;
  readonly title: string;
  readonly artist: string | null;
  readonly coverUrl: string | null;
  readonly useCount: number;
  readonly active: boolean;
  readonly createdAt: string;
}

export interface ModerationTargetPreview {
  readonly ownerId: string;
  readonly title: string | null;
  readonly text: string | null;
  readonly mediaUrls: readonly string[];
  readonly mediaIds?: readonly string[];
  readonly soundTitle: string | null;
  readonly createdAt: string;
}

export interface AdContentMedia {
  readonly id: string;
  readonly kind: "image" | "video";
  readonly url: string;
  readonly posterUrl: string | null;
  readonly width: number;
  readonly height: number;
  readonly durationSeconds: number | null;
}

export interface AdContentSource {
  readonly id: string;
  readonly type: "post" | "clip";
  readonly title: string;
  readonly text: string;
  readonly media: readonly AdContentMedia[];
  readonly createdAt: string;
  readonly engagement: { readonly likes: number; readonly comments: number; readonly views: number };
  readonly product: null;
  readonly eligible: boolean;
  readonly ineligibleReason: string | null;
}

export interface AudienceMember {
  readonly accountId: string;
  readonly lastActiveAt: string;
  readonly interactions: number;
}

export interface CursorPage<T> {
  readonly data: readonly T[];
  readonly nextCursor: string | null;
}
