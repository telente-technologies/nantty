import type { ContentVisibility } from "../../../interfaces/creatorSubscriberLookup.interface.js";
import type { SponsoredDto } from "../../../interfaces/discovery.interface.js";
import type { MoneyDto } from "../../../utils/money.util.js";
import type { PostKind, PostMedia } from "../models/posts.model.js";

export interface ProductCardDto {
  readonly id: string;
  readonly name: string;
  readonly storeId: string;
  readonly price: MoneyDto;
  readonly compareAtPrice: MoneyDto | null;
  readonly imageUrl: string | null;
  readonly rating: number;
  readonly ratingCount: number;
}

export interface StoreBadgeDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly logoUrl: string | null;
}

export interface AuthorDto {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly avatarUrl: string | null;
  readonly verified: boolean;
}

export interface FriendsLikedDto {
  readonly count: number;
  readonly avatars: readonly (string | null)[];
}

export interface PostDto {
  readonly id: string;
  readonly kind: PostKind;
  readonly author: AuthorDto | null;
  readonly createdAt: string;
  readonly text: string;
  readonly media: readonly PostMedia[];
  readonly likes: number;
  readonly comments: number;
  readonly reposts: number;
  readonly shares: number;
  readonly views: number;
  readonly liked: boolean;
  readonly bookmarked: boolean;
  readonly isFollowingAuthor: boolean;
  readonly friendsLiked: FriendsLikedDto | null;
  readonly sponsored: SponsoredDto | null;
  readonly products: readonly ProductCardDto[];
  readonly store: StoreBadgeDto | null;
  readonly topics: readonly string[];
  readonly audience: "everyone";
  readonly visibility: ContentVisibility;
  readonly locked: boolean;
  readonly lockedMediaCount: number;
  readonly repostOf: PostDto | null;
  readonly expiresAt: string | null;
}

export interface CommentReplyTargetDto {
  readonly userId: string;
  readonly username: string;
}

export interface CommentDto {
  readonly id: string;
  readonly postId: string;
  readonly parentCommentId: string | null;
  readonly rootCommentId: string | null;
  readonly replyToCommentId: string | null;
  readonly text: string;
  readonly author: AuthorDto | null;
  readonly likes: number;
  readonly liked: boolean;
  readonly replyCount: number;
  readonly replyingTo?: CommentReplyTargetDto;
  readonly deleted?: true;
  readonly createdAt: string;
}

export interface TopLevelCommentDto extends CommentDto {
  readonly previewReplies: readonly CommentDto[];
}

export interface LiveSessionDto {
  readonly id: string;
  readonly title: string;
  readonly status: "live" | "ended";
  readonly host: AuthorDto | null;
  readonly store: StoreBadgeDto | null;
  readonly viewerCount: number;
  readonly reactionCount: number;
  readonly products: readonly ProductCardDto[];
  readonly pinnedProduct: ProductCardDto | null;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly visibility: ContentVisibility;
  readonly sponsored: SponsoredDto | null;
}

export interface LiveCommentDto {
  readonly id: string;
  readonly text: string;
  readonly author: AuthorDto | null;
  readonly createdAt: string;
}

export interface StoryDto {
  readonly id: string;
  readonly media: readonly PostMedia[];
  readonly text: string;
  readonly seen: boolean;
  readonly createdAt: string;
  readonly expiresAt: string | null;
}

export interface StoryTrayEntryDto {
  readonly author: AuthorDto | null;
  readonly hasUnseen: boolean;
  readonly latestStoryAt: string;
  readonly stories: readonly StoryDto[];
}
