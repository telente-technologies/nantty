import type { AdAppInstall, AdCard, AdClickLinks, AdCreativeType, AdDestination } from "./adCreative.type";
import type { Money } from "./money.type";

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
}

export interface UserSummary {
  readonly id: ID;
  readonly name: string;
  readonly username: string;
  readonly avatarUrl: string | null;
  readonly verified: boolean;
  readonly isCreator?: boolean;
  readonly verification?: Verification | null;
}

export interface User extends UserSummary {
  readonly bio: string;
  readonly bannerUrl: string | null;
  readonly email?: string;
  readonly emailVerified?: boolean;
  readonly phone?: string | null;
  readonly followers: number;
  readonly following: number;
  readonly posts: number;
  readonly joinedAt: ISODate;
  readonly isFollowing?: boolean;
  readonly isSeller?: boolean;
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

export interface ProductSummary {
  readonly id: ID;
  readonly name: string;
  readonly price: Money;
  readonly approxPrice?: Money | null;
  readonly priceIsRegional?: boolean;
  readonly imageUrl: string | null;
  readonly liked?: boolean;
  readonly bookmarked?: boolean;
  readonly saveCount?: number;
  readonly stock?: number;
  readonly sponsored?: SponsoredPlacement | null;
}

export interface Product extends ProductSummary {
  readonly images: readonly string[];
  readonly title: string;
  readonly rating: number;
  readonly promo: string | null;
  readonly sizes: readonly string[];
  readonly colors: readonly string[];
  readonly shippingInfo: string;
  readonly description: string;
  readonly store: StoreSummary;
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
  readonly label: "Sponsored" | "Promoted";
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
}

export interface Post {
  readonly id: ID;
  readonly kind: "post" | "clip";
  readonly author: UserSummary;
  readonly createdAt: ISODate;
  readonly text: string;
  readonly media: readonly Media[];
  readonly likes: number;
  readonly comments: number;
  readonly reposts: number;
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
  readonly mentions?: readonly import("./mentions.type").MentionEntity[];
  readonly linkPreview?: import("./linkPreview.type").LinkPreview | null;
  readonly isQuote?: boolean;
  readonly quotes?: number;
  readonly replyPolicy?: import("./postAudience.type").ReplyPolicy;
  readonly viewerCanReply?: boolean;
  readonly viewerCanDownload?: boolean;
  readonly replyRestriction?: import("./postAudience.type").ReplyRestriction | null;
  readonly sensitive?: import("./postAudience.type").SensitiveContent | null;
  readonly taggedUsers?: readonly import("./taggedUser.type").TaggedUser[];
  readonly taggedUsersCount?: number;
}

export interface PostAnalyticsDaily {
  readonly day: ISODate;
  readonly impressions: number;
}

export interface PostAnalytics {
  readonly postId: ID;
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
  readonly video: { readonly views: number; readonly watchTimeSeconds: number } | null;
  readonly audience: readonly { readonly label: string; readonly share: number }[];
  readonly daily: readonly PostAnalyticsDaily[];
}

export interface Comment {
  readonly id: ID;
  readonly postId: ID;
  readonly parentCommentId: ID | null;
  readonly rootCommentId: ID | null;
  readonly author: UserSummary;
  readonly text: string;
  readonly createdAt: ISODate;
  readonly likes: number;
  readonly liked: boolean;
  readonly replyCount: number;
  readonly replyingTo?: { readonly userId: ID; readonly username: string };
  readonly mentions?: readonly import("./mentions.type").MentionEntity[];
}

export interface Conversation {
  readonly id: ID;
  readonly peer: UserSummary;
  readonly lastMessage: string;
  readonly lastMessageAt: ISODate;
  readonly unread: number;
  readonly isFriend: boolean;
  readonly kind?: "direct" | "group" | "channel" | "business";
  readonly title?: string | null;
  readonly photoUrl?: string | null;
  readonly memberCount?: number;
  readonly subscriberCount?: number;
  readonly myRole?: "owner" | "admin" | "member" | "subscriber";
  readonly disappearingMessagesSeconds?: number | null;
  readonly store?: { readonly id: ID; readonly name: string } | null;
}

export interface MessageReactionSummary {
  readonly emoji: string;
  readonly count: number;
  readonly reactedByMe: boolean;
}

export interface MessageAttachedMedia {
  readonly id: ID;
  readonly type: "voice" | "image" | "video";
  readonly url: string | null;
  readonly durationSeconds?: number;
}

export interface Message {
  readonly id: ID;
  readonly conversationId: ID;
  readonly senderId: ID;
  readonly text: string;
  readonly createdAt: ISODate;
  readonly kind?: "text" | "voice" | "image" | "system";
  readonly sender?: UserSummary;
  readonly media?: MessageAttachedMedia | null;
  readonly reactions?: readonly MessageReactionSummary[];
  readonly expiresAt?: ISODate | null;
}

export interface Story {
  readonly id: ID;
  readonly author: UserSummary;
  readonly media: Media;
  readonly createdAt: ISODate;
  readonly seen: boolean;
}

export interface LiveSession {
  readonly id: ID;
  readonly host: UserSummary & { readonly followers: number; readonly following: number };
  readonly title: string;
  readonly viewers: number;
  readonly status: "live" | "ended";
  readonly products: readonly ProductSummary[];
}

export interface LiveComment {
  readonly id: ID;
  readonly author: UserSummary;
  readonly text: string;
  readonly kind: "comment" | "joined" | "reply" | "gift";
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

export type { CartItem, Cart, OrderStatus, PaymentMode, Order, Address, WalletSummary, WalletTransaction, PayoutAccount, SellerDashboard } from "./orders.type";

export interface StoreCreditBalance {
  readonly storeId: ID;
  readonly storeName: string;
  readonly logoUrl: string | null;
  readonly balance: Money;
  readonly expiresAt: ISODate | null;
  readonly earnBackBasisPoints: number | null;
}
