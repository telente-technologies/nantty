export type ConsentKey = "personalization" | "personalizedAds" | "analytics" | "marketing";
export type ConsentChoices = Readonly<Record<ConsentKey, boolean>>;

export type ProductInteractionEvent =
  | "product.viewed"
  | "product.clicked"
  | "product.addedToCart"
  | "product.removedFromCart"
  | "product.purchased"
  | "search.performed"
  | "seller.viewed"
  | "category.viewed";

export type ProductInteractionSurface = "search" | "feed_recommendations" | "clips_recommendations" | "mart_home";

export type ProductInteractionPayload = Readonly<Record<string, string | number | null>>;

export interface ProductInteractionRecord {
  readonly event: ProductInteractionEvent;
  readonly payload: ProductInteractionPayload;
  readonly occurredAt: string;
}

export interface ConsentRecord {
  readonly policyVersion: string;
  readonly consents: ConsentChoices;
  readonly updatedAt: string;
}

export interface UpdateConsentsInput {
  readonly policyVersion?: string;
  readonly policyVersionId?: string;
  readonly consents: Partial<ConsentChoices>;
}

export type DataExportStatus = "none" | "requested" | "processing" | "ready";

export interface DataExportRequest {
  readonly status: DataExportStatus;
  readonly requestedAt: string | null;
  readonly downloadUrl: string | null;
  readonly expiresAt: string | null;
}

export interface AccountDeletionSchedule {
  readonly id?: string;
  readonly status?: "scheduled" | "cancelled" | "executed";
  readonly scheduledFor: string;
  readonly cancelledAt?: string | null;
}
