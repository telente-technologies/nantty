export type ReviewKind = "product" | "store";
export type ReviewStatus = "published" | "reported" | "hidden";
export type ReviewReportReason = "spam" | "offensive" | "fake" | "not_about_purchase" | "personal_information" | "other";

export interface ReviewReply {
  readonly body: string;
  readonly authorName: string;
  readonly createdAt: string;
  readonly updatedAt: string | null;
}

export interface Review {
  readonly id: string;
  readonly kind: ReviewKind;
  readonly product: { readonly id: string; readonly name: string; readonly imageUrl: string | null } | null;
  readonly rating: number;
  readonly title: string | null;
  readonly body: string;
  readonly author: { readonly name: string; readonly username: string };
  readonly orderNumber: string | null;
  readonly isVerifiedPurchase: boolean;
  readonly photoCount: number;
  readonly helpfulCount: number;
  readonly status: ReviewStatus;
  readonly reply: ReviewReply | null;
  readonly createdAt: string;
}

export interface ReviewTrendPoint {
  readonly month: string;
  readonly averageRatingHundredths: number;
  readonly reviewCount: number;
}

export interface ReviewsSummary {
  readonly averageRatingHundredths: number;
  readonly totalReviews: number;
  readonly productReviews: number;
  readonly storeReviews: number;
  readonly distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
  readonly responseRateBasisPoints: number;
  readonly unansweredCount: number;
  readonly trend: ReviewTrendPoint[];
}
