export type ID = string;
export type ISODate = string;
export type Kobo = number;

export interface UserSummary {
  readonly id: ID;
  readonly name: string;
  readonly username: string;
  readonly avatarUrl: string | null;
  readonly verified: boolean;
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
  readonly isSeller?: boolean;
  readonly storeId?: ID | null;
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
}

export interface ProductSummary {
  readonly id: ID;
  readonly name: string;
  readonly price: Kobo;
  readonly imageUrl: string | null;
  readonly liked?: boolean;
  readonly stock?: number;
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

export interface Media {
  readonly type: "image" | "video";
  readonly url: string | null;
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
  readonly isFollowingAuthor: boolean;
  readonly friendsLiked: { readonly count: number; readonly avatars: readonly (string | null)[] } | null;
  readonly products: readonly ProductSummary[];
}

export interface Comment {
  readonly id: ID;
  readonly author: UserSummary;
  readonly text: string;
  readonly createdAt: ISODate;
  readonly likes: number;
  readonly liked: boolean;
}

export interface CartItem {
  readonly id: ID;
  readonly product: ProductSummary;
  readonly quantity: number;
  readonly variant: string | null;
}

export interface Cart {
  readonly items: readonly CartItem[];
  readonly itemsTotal: Kobo;
  readonly shopDiscount: Kobo;
  readonly shipping: Kobo;
  readonly total: Kobo;
}

export type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "completed" | "cancelled" | "disputed";

export interface Order {
  readonly id: ID;
  readonly reference: string;
  readonly status: OrderStatus;
  readonly items: readonly CartItem[];
  readonly total: Kobo;
  readonly buyer: UserSummary;
  readonly store: StoreSummary;
  readonly createdAt: ISODate;
  readonly escrowReleaseAt: ISODate | null;
}

export interface Address {
  readonly id: ID;
  readonly fullName: string;
  readonly phone: string;
  readonly line1: string;
  readonly city: string;
  readonly state: string;
  readonly isDefault: boolean;
}

export interface Conversation {
  readonly id: ID;
  readonly peer: UserSummary;
  readonly lastMessage: string;
  readonly lastMessageAt: ISODate;
  readonly unread: number;
  readonly isFriend: boolean;
}

export interface Message {
  readonly id: ID;
  readonly conversationId: ID;
  readonly senderId: ID;
  readonly text: string;
  readonly createdAt: ISODate;
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
  readonly kind: "comment" | "joined" | "reply";
}

export interface AppNotification {
  readonly id: ID;
  readonly title: string;
  readonly body: string;
  readonly createdAt: ISODate;
  readonly read: boolean;
  readonly actor: UserSummary | null;
}

export interface WalletSummary {
  readonly available: Kobo;
  readonly pending: Kobo;
  readonly currency: "NGN";
}

export interface WalletTransaction {
  readonly id: ID;
  readonly kind: "credit" | "debit";
  readonly amount: Kobo;
  readonly description: string;
  readonly createdAt: ISODate;
  readonly status: "pending" | "completed" | "failed";
}

export interface PayoutAccount {
  readonly id: ID;
  readonly bankName: string;
  readonly accountNumberMasked: string;
  readonly accountName: string;
}

export interface SellerDashboard {
  readonly totalSales: Kobo;
  readonly orders: number;
  readonly series: readonly { readonly label: string; readonly value: number }[];
  readonly recentOrders: readonly Order[];
  readonly inventory: readonly ProductSummary[];
}

export interface Page<T> {
  readonly data: readonly T[];
  readonly nextCursor: string | null;
}

export interface AuthSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly user: User;
}
