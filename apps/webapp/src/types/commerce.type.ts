import type { AppNotification, Category, ID, ISODate, Order, Post, ProductSummary, StoreSummary, UserSummary } from "./models.type";
import type { Money } from "./money.type";

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
  readonly brands?: readonly import("./brand.type").BrandSummary[];
}

export interface ProductReviewReply {
  readonly body: string;
  readonly authorName: string;
  readonly createdAt: ISODate;
}

export interface ReviewAuthor {
  readonly id: ID;
  readonly name: string;
  readonly username: string;
  readonly avatarUrl: string | null;
}

export interface ProductReview {
  readonly id: ID;
  readonly author: ReviewAuthor;
  readonly rating: number;
  readonly text: string;
  readonly title?: string | null;
  readonly isVerifiedPurchase?: boolean;
  readonly reply?: ProductReviewReply | null;
  readonly createdAt: ISODate;
}

export interface ProductReviewSummary {
  readonly average: number;
  readonly count: number;
  readonly reviews: readonly ProductReview[];
  readonly nextCursor?: string | null;
}

export type RatingStar = "1" | "2" | "3" | "4" | "5";

export interface ProductRatingSummary {
  readonly average: number;
  readonly count: number;
  readonly distribution: Readonly<Record<RatingStar, number>>;
}

export interface SubmitReviewInput {
  readonly rating: number;
  readonly text: string;
  readonly title: string | null;
}

export interface StoreDetail extends StoreSummary {
  readonly ownerUserId: ID;
  readonly officialBrand?: import("./brand.type").BrandSummary | null;
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

export type PaymentProvider = "flutterwave";

export type PaymentChannel = "card" | "bank" | "bank_transfer" | "ussd";

export interface PaymentIntentSummary {
  readonly reference: string;
  readonly provider: PaymentProvider | string;
  readonly status: string;
  readonly amount: Money;
}

export interface PaymentInitialization {
  readonly orderId: ID;
  readonly reference: string;
  readonly checkoutUrl?: string | null;
  readonly authorizationUrl: string;
  readonly accessCode?: string;
  readonly payment?: PaymentIntentSummary;
}

export interface CheckoutResult {
  readonly orders: readonly Order[];
  readonly payableOrderId: ID;
  readonly total: Money;
}

export type DisputeReason = "not_received" | "not_as_described" | "damaged" | "wrong_item" | "other";

export type NotificationCategory = "orders" | "social" | "system";

export interface CategorizedNotification extends AppNotification {
  readonly category: NotificationCategory;
  readonly kind?: string;
}

export type EscrowStage =
  | "awaiting_payment"
  | "paid_into_escrow"
  | "seller_preparing"
  | "shipped"
  | "delivered"
  | "buyer_confirmed"
  | "released_to_seller"
  | "disputed"
  | "under_review"
  | "refunded";

export interface ShipmentDetails {
  readonly courierName: string;
  readonly trackingNumber: string;
  readonly trackingUrl: string | null;
  readonly shippedAt: ISODate;
  readonly estimatedDeliveryAt: ISODate | null;
}

export interface EscrowDetail {
  readonly orderId: ID;
  readonly orderReference: string;
  readonly stage: EscrowStage;
  readonly heldAmount: Money;
  readonly platformFee: Money;
  readonly sellerPayoutAmount: Money;
  readonly buyer: UserSummary;
  readonly store: StoreSummary;
  readonly sellerUserId: ID;
  readonly paidAt: ISODate | null;
  readonly preparingSince: ISODate | null;
  readonly shipment: ShipmentDetails | null;
  readonly deliveredAt: ISODate | null;
  readonly buyerConfirmedAt: ISODate | null;
  readonly autoReleaseAt: ISODate | null;
  readonly expectedReleaseAt: ISODate | null;
  readonly releasedAt: ISODate | null;
  readonly refundedAt: ISODate | null;
  readonly disputeId: ID | null;
  readonly undeliveredReviewAt?: ISODate | null;
  readonly refundedAmount?: Money;
  readonly feesKeptOnRefund?: Money;
}

export interface EscrowHold {
  readonly orderId: ID;
  readonly orderReference: string;
  readonly productName: string;
  readonly amount: Money;
  readonly stage: EscrowStage;
  readonly expectedReleaseAt: ISODate | null;
}

export interface MarkOrderShippedInput {
  readonly courierName: string;
  readonly trackingNumber: string;
}

export type DisputeStatus = "open" | "awaiting_seller" | "under_review" | "resolved_refunded" | "resolved_released" | "closed";
export type DisputeParticipantRole = "buyer" | "seller" | "support";

export interface DisputeMessage {
  readonly id: ID;
  readonly authorRole: DisputeParticipantRole;
  readonly authorName: string;
  readonly authorAvatarUrl: string | null;
  readonly text: string;
  readonly attachmentUrls: readonly string[];
  readonly createdAt: ISODate;
}

export interface DisputeStatusEvent {
  readonly status: DisputeStatus;
  readonly label: string;
  readonly occurredAt: ISODate;
}

export interface Dispute {
  readonly id: ID;
  readonly orderId: ID;
  readonly orderReference: string;
  readonly productName: string;
  readonly amount: Money;
  readonly reason: DisputeReason;
  readonly description: string;
  readonly evidenceUrls: readonly string[];
  readonly status: DisputeStatus;
  readonly viewerRole: "buyer" | "seller";
  readonly counterpartyName: string;
  readonly openedAt: ISODate;
  readonly respondByAt: ISODate | null;
  readonly resolutionNote: string | null;
  readonly statusHistory: readonly DisputeStatusEvent[];
  readonly messages: readonly DisputeMessage[];
}

export interface OpenDisputeInput {
  readonly reason: DisputeReason;
  readonly description: string;
  readonly evidenceUrls: readonly string[];
}

export interface Bank {
  readonly code: string;
  readonly name: string;
  readonly countryCode: string;
}

export interface ResolvedBankAccount {
  readonly accountName: string;
}

export type ProductCollection = "sales_of_the_day" | "featured_brands" | "new_arrivals";

export interface MyStoreSummary {
  readonly storeId: string;
  readonly storeName: string;
  readonly role: string;
  readonly isCurrent: boolean;
}
