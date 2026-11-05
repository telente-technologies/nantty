import type { PostLocationTag } from "./clipCreate.type";
import type { AdAppInstall, AdCard, AdClickLinks, AdCreativeType, AdDestination, AdPromotedEntity } from "./adCreative.type";
import type { Money } from "./money.type";
import type { Order } from "./cartOrder.type";
import type { FollowState } from "./socialGraph.type";
import type { MentionEntity } from "./mention.type";
import type { TaggedUser } from "./taggedUser.type";
import type { ReplyPolicy, ReplyRestriction, SensitiveContent } from "./postAudience.type";

export type ID = string;
export type ISODate = string;

export type VerificationColor = "blue" | "gold" | "black";
export type VerificationProfileType = "personal" | "business" | "government";
export type VerificationTier = "ESSENTIAL" | "VERIFIED" | "PREMIUM" | "PRO" | "OFFICIAL";
export type VerificationStatus = "none" | "pending" | "active" | "expired" | "revoked";

export interface Verification {
  readonly status: VerificationStatus;
  readonly type: VerificationProfileType;
  readonly color: VerificationColor;
  readonly tier: VerificationTier;
  readonly badgeVisible: boolean;
  readonly graceEndsAt?: ISODate | null;
}

export interface CreatorLiveStatus {
  readonly liveId: ID;
  readonly startedAt: ISODate;
}

export type AccountStatus = "active" | "suspended" | "deactivated";

export interface AccountInfo {
  readonly status: AccountStatus;
}

export interface UserSummary {
  readonly id: ID;
  readonly account?: AccountInfo;
  readonly name: string;
  readonly username: string;
  readonly avatarUrl: string | null;
  readonly verified: boolean;
  readonly isCreator?: boolean;
  readonly isPremium?: boolean;
  readonly verification?: Verification | null;
  readonly live?: CreatorLiveStatus | null;
}

export interface User extends UserSummary {
  readonly bio: string;
  readonly bannerUrl: string | null;
  readonly email?: string;
  readonly phone?: string | null;
  readonly followers: number;
  readonly following: number;
  readonly posts: number;
  readonly joinedAt: ISODate;
  readonly isFollowing?: boolean;
  readonly isPrivate?: boolean;
  readonly followState?: FollowState;
  readonly isSeller?: boolean;
  readonly profileKind?: "personal" | "store" | "business";
  readonly showsMart?: boolean;
  readonly storeId?: ID | null;
  readonly birthdayToday?: boolean;
  readonly anniversaryToday?: boolean;
}

export interface Topic {
  readonly id: ID;
  readonly name: string;
}

export interface Category {
  readonly id: ID;
  readonly name: string;
}

export interface StoreSummary {
  readonly id: ID;
  readonly name: string;
  readonly logoUrl: string | null;
  readonly rating: number;
  readonly ratingCount: number;
  readonly reviewCount: number;
  readonly verification?: Verification | null;
  readonly successRate?: number | null;
  readonly earnBackBasisPoints?: number | null;
}

export interface ProductStoreSummary extends StoreSummary {
  readonly isFollowing?: boolean;
}

export interface ProductVariantGroup {
  readonly name: string;
  readonly options: readonly string[];
}

export interface ProductSummary {
  readonly id: ID;
  readonly name: string;
  readonly price: Money;
  readonly approxPrice?: Money | null;
  readonly priceIsRegional?: boolean;
  readonly imageUrl: string | null;
  readonly liked?: boolean;
  readonly stock?: number;
  readonly sponsored?: SponsoredPlacement | null;
  readonly hasVariants: boolean;
  readonly variantGroups?: readonly ProductVariantGroup[] | null;
}

export interface Product extends ProductSummary {
  readonly saveCount?: number;
  readonly images: readonly string[];
  readonly title: string;
  readonly rating: number;
  readonly promo: string | null;
  readonly sizes: readonly string[];
  readonly colors: readonly string[];
  readonly variantGroups: readonly ProductVariantGroup[];
  readonly shippingInfo: string;
  readonly description: string;
  readonly store: ProductStoreSummary;
  readonly related: readonly ProductSummary[];
}

export type MediaProcessingStatus = "processing" | "ready" | "failed";

export interface Media {
  readonly type: "image" | "video";
  readonly url: string | null;
  readonly id?: ID;
  readonly posterUrl?: string | null;
  readonly hlsUrl?: string | null;
  readonly width?: number;
  readonly height?: number;
  readonly durationSeconds?: number;
  readonly status?: MediaProcessingStatus;
  readonly blurhash?: string | null;
}

export interface SponsoredPlacement {
  readonly campaignId: ID;
  readonly label: "Sponsored" | "Promoted" | "Boosted";
  readonly advertiserName: string;
  readonly ctaLabel?: string;
  readonly ctaUrl?: string;
  readonly adType?: AdCreativeType;
  readonly impressionToken?: string;
  readonly clickLinks?: AdClickLinks;
  readonly destination?: AdDestination;
  readonly mediaClickable?: boolean;
  readonly cards?: readonly AdCard[];
  readonly app?: AdAppInstall;
  readonly promoted?: AdPromotedEntity;
}

export interface Post {
  readonly id: ID;
  readonly kind: "post" | "clip";
  readonly author: UserSummary;
  readonly postedAs?: { readonly id: ID; readonly kind: string; readonly name: string; readonly handle: string; readonly avatarUrl: string | null } | null;
  readonly createdAt: ISODate;
  readonly publicationState?: "published" | "scheduled" | "cancelled" | "failed";
  readonly scheduledAt?: ISODate | null;
  readonly text: string;
  readonly media: readonly Media[];
  readonly likes: number;
  readonly comments: number;
  readonly reposts: number;
  readonly reposted?: boolean;
  readonly views: number;
  readonly liked: boolean;
  readonly bookmarked: boolean;
  readonly saveCount?: number;
  readonly isFollowingAuthor: boolean;
  readonly friendsLiked: { readonly count: number; readonly avatars: readonly (string | null)[] } | null;
  readonly products: readonly ProductSummary[];
  readonly sponsored?: SponsoredPlacement | null;
  readonly subscriberOnly?: boolean;
  readonly viewerHasAccess?: boolean;
  readonly resharedFrom?: Post | null;
  readonly resharedFromUnavailable?: boolean;
  readonly isQuote?: boolean;
  readonly quotes?: number;
  readonly replyPolicy?: ReplyPolicy;
  readonly viewerCanReply?: boolean;
  readonly viewerCanDownload?: boolean;
  readonly replyRestriction?: ReplyRestriction | null;
  readonly sensitive?: SensitiveContent | null;
  readonly isAiGenerated?: boolean;
  readonly isPinned?: boolean;
  readonly pinnedAt?: ISODate | null;
  readonly pinnedCommentId?: ID | null;
  readonly viewerNotificationsMuted?: boolean;
  readonly location?: PostLocationTag | null;
  readonly mentions?: readonly MentionEntity[];
  readonly taggedUsers?: readonly TaggedUser[];
  readonly taggedUsersCount?: number;
  readonly replyToComment?: ReplyToComment;
  readonly stickerLayout?: CommentStickerLayout;
  readonly look?: string | null;
  readonly linkPreview?: import("./chatSafety.type").LinkPreview | null;
}

export interface PostAnalyticsDaily {
  readonly day: ISODate;
  readonly impressions: number;
}

export interface PostVideoAnalytics {
  readonly views: number;
  readonly watchTimeSeconds: number;
  readonly averageWatchSeconds?: number;
  readonly completedViews?: number;
  readonly completionRate?: number;
}

export interface PostAnalytics {
  readonly postId: ID;
  readonly kind?: "post" | "clip" | "story";
  readonly hasLink?: boolean;
  readonly author: UserSummary;
  readonly postedAt: ISODate;
  readonly impressions: number;
  readonly uniqueViewers: number;
  readonly likes: number;
  readonly comments: number;
  readonly reposts: number;
  readonly profileVisits: number;
  readonly saves: number;
  readonly shares: number;
  readonly linkClicks: number;
  readonly profileClicks: number;
  readonly newFollows: number;
  readonly engagements: number;
  readonly engagementRate: number;
  readonly video: PostVideoAnalytics | null;
  readonly audience: readonly { readonly label: string; readonly share: number }[];
  readonly daily: readonly PostAnalyticsDaily[];
}

export interface QuotedPostSummary {
  readonly id: ID;
  readonly kind: "post" | "clip";
  readonly author: UserSummary;
  readonly text: string;
  readonly thumbnail: { readonly type: "image" | "video"; readonly url: string; readonly blurhash: string | null } | null;
  readonly mediaCount: number;
  readonly createdAt: ISODate;
}

export interface Comment {
  readonly id: ID;
  readonly postId: ID;
  readonly parentCommentId: ID | null;
  readonly rootCommentId: ID | null;
  readonly author: UserSummary;
  readonly postedAs?: { readonly id: ID; readonly kind: string; readonly name: string; readonly handle: string; readonly avatarUrl: string | null; readonly checkmark?: VerificationColor | null } | null;
  readonly text: string;
  readonly createdAt: ISODate;
  readonly likes: number;
  readonly liked: boolean;
  readonly bookmarked: boolean;
  readonly replyCount: number;
  readonly isPinned?: boolean;
  readonly pinnedAt?: ISODate | null;
  readonly replyingTo?: { readonly userId: ID; readonly username: string };
  readonly mentions?: readonly MentionEntity[];
  readonly videoReplies?: readonly CommentVideoReply[];
  readonly videoReplyBlocked?: boolean;
  readonly isPostAuthor?: boolean;
  readonly quotedPost?: QuotedPostSummary | null;
  readonly quotedPostUnavailable?: boolean;
}

export interface CommentHiddenState {
  readonly commentId: ID;
  readonly postId: ID;
  readonly hidden: boolean;
  readonly hiddenAt: ISODate | null;
}

export interface MyPostComment extends Comment {
  readonly previewReplies: readonly Comment[];
  readonly post: { readonly id: ID; readonly kind: string; readonly text: string; readonly thumbnailUrl: string | null };
  readonly hidden: boolean;
  readonly hiddenAt: ISODate | null;
  readonly needsReply: boolean;
}

export interface CommentVideoReply {
  readonly clipId: ID;
  readonly thumbnailUrl: string | null;
  readonly createdAt: ISODate;
}

export interface CommentStickerLayout {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly rotation: number;
  readonly hidden?: boolean;
}

export interface ReplyToComment {
  readonly commentId: ID;
  readonly clipId: ID;
  readonly commenterUserId: ID;
}

export interface Story {
  readonly id: ID;
  readonly author: UserSummary;
  readonly media: Media;
  readonly createdAt: ISODate;
  readonly seen: boolean;
  readonly sound?: { readonly id: ID; readonly title: string; readonly owner?: UserSummary | null } | null;
  readonly look?: string | null;
}

export interface LiveSession {
  readonly id: ID;
  readonly host: UserSummary & { readonly followers: number; readonly following: number };
  readonly title: string;
  readonly viewers: number;
  readonly status: "upcoming" | "live" | "ended";
  readonly products: readonly ProductSummary[];
}

export interface LiveComment {
  readonly id: ID;
  readonly author: UserSummary;
  readonly text: string;
  readonly kind: "comment" | "joined" | "reply" | "gift" | "follow";
  readonly gift?: { readonly giftId: ID; readonly name: string; readonly emoji: string; readonly quantity: number };
}

export interface AppNotification {
  readonly id: ID;
  readonly title: string;
  readonly body: string;
  readonly createdAt: ISODate;
  readonly read: boolean;
  readonly actor: UserSummary | null;
}

export interface Page<T> {
  readonly data: readonly T[];
  readonly nextCursor: string | null;
}

export interface AuthSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly user: User;
  readonly notice?: string | null;
}

export * from "./cartOrder.type";
export * from "./messaging.type";
