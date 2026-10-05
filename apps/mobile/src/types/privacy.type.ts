export type ConsentKey = "personalization" | "advertising" | "analytics" | "marketing";

export type ConsentChoices = Readonly<Record<ConsentKey, boolean>>;

export interface ConsentRecord {
  readonly policyVersionId: string;
  readonly consents: ConsentChoices;
  readonly updatedAt: string;
}

export interface UpdateConsentsInput {
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

export interface AccountDeletionRequest {
  readonly scheduledFor: string;
}

export type ProductInteractionEvent =
  | "product.viewed"
  | "product.clicked"
  | "product.addedToCart"
  | "product.removedFromCart"
  | "product.purchased"
  | "search.performed"
  | "seller.viewed"
  | "category.viewed";

export interface ProductInteractionRecord {
  readonly event: ProductInteractionEvent;
  readonly payload: Readonly<Record<string, string | number | null>>;
  readonly occurredAt: string;
}
