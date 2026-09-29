import type { UserSummary } from "../../../interfaces/userDirectory.interface.js";
import type { MoneyDto } from "../../../utils/money.util.js";
import type { PostKind, PostMedia } from "../models/posts.model.js";

export interface ProductCardDto {
  readonly id: string;
  readonly storeId: string;
  readonly title: string;
  readonly price: MoneyDto;
  readonly compareAtPrice: MoneyDto | null;
  readonly imageUrl: string | null;
  readonly ratingAverage: number;
  readonly ratingCount: number;
}

export interface StoreBadgeDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly logoUrl: string | null;
}

export interface PostDto {
  readonly id: string;
  readonly kind: PostKind;
  readonly text: string;
  readonly media: readonly PostMedia[];
  readonly audience: "everyone";
  readonly topics: readonly string[];
  readonly author: UserSummary | null;
  readonly store: StoreBadgeDto | null;
  readonly taggedProducts: readonly ProductCardDto[];
  readonly repostOf: PostDto | null;
  readonly counts: {
    readonly likes: number;
    readonly comments: number;
    readonly reposts: number;
    readonly shares: number;
    readonly views: number;
  };
  readonly likedByMe: boolean;
  readonly expiresAt: string | null;
  readonly createdAt: string;
}

export interface CommentDto {
  readonly id: string;
  readonly postId: string;
  readonly parentId: string | null;
  readonly text: string;
  readonly author: UserSummary | null;
  readonly createdAt: string;
}

export interface LiveSessionDto {
  readonly id: string;
  readonly title: string;
  readonly status: "live" | "ended";
  readonly host: UserSummary | null;
  readonly store: StoreBadgeDto | null;
  readonly viewerCount: number;
  readonly products: readonly ProductCardDto[];
  readonly pinnedProduct: ProductCardDto | null;
  readonly startedAt: string;
  readonly endedAt: string | null;
}

export interface LiveCommentDto {
  readonly id: string;
  readonly text: string;
  readonly author: UserSummary | null;
  readonly createdAt: string;
}

export interface StoryGroupDto {
  readonly author: UserSummary | null;
  readonly stories: readonly PostDto[];
}
