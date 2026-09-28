import type { AppNotification, Category, ID, ISODate, Kobo, Order, Post, ProductSummary, StoreSummary, UserSummary } from "./models.type";

export interface MartHome {
  readonly banners: readonly { readonly id: ID; readonly imageUrl: string | null }[];
  readonly salesOfTheDayImageUrl: string | null;
  readonly featuredBrandsImageUrl: string | null;
  readonly newArrivalsImageUrl: string | null;
  readonly categories: readonly Category[];
}

export interface SuggestedClip {
  readonly id: ID;
  readonly thumbnailUrl: string | null;
}

export interface SearchResults {
  readonly products: readonly ProductSummary[];
  readonly stores: readonly StoreSummary[];
  readonly people: readonly UserSummary[];
}

export interface ProductReview {
  readonly id: ID;
  readonly author: UserSummary;
  readonly rating: number;
  readonly text: string;
  readonly createdAt: ISODate;
}

export interface ProductReviewSummary {
  readonly average: number;
  readonly count: number;
  readonly reviews: readonly ProductReview[];
}

export interface StoreDetail extends StoreSummary {
  readonly bannerUrl: string | null;
  readonly handle: string;
  readonly bio: string;
  readonly followers: number;
  readonly productsCount: number;
  readonly isFollowing: boolean;
  readonly verified: boolean;
  readonly joinedAt: ISODate;
  readonly posts: readonly Post[];
}

export type PaymentProvider = "paystack" | "flutterwave";

export interface PaymentInitialization {
  readonly orderId: ID;
  readonly reference: string;
  readonly authorizationUrl: string;
}

export interface CheckoutResult {
  readonly orders: readonly Order[];
  readonly payableOrderId: ID;
  readonly total: Kobo;
}

export type DisputeReason = "not_received" | "not_as_described" | "damaged" | "wrong_item" | "other";

export type NotificationCategory = "orders" | "social" | "system";

export interface CategorizedNotification extends AppNotification {
  readonly category: NotificationCategory;
}
