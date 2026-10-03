export type BusinessDocumentKind = "cac_certificate" | "government_id" | "proof_of_address";
export type BusinessDocumentStatus = "not_uploaded" | "in_review" | "approved" | "rejected";

export interface BusinessDocumentView {
  readonly kind: BusinessDocumentKind;
  readonly label: string;
  readonly description: string;
  readonly status: BusinessDocumentStatus;
  readonly fileName: string | null;
  readonly uploadedAt: string | null;
  readonly rejectionReason: string | null;
}

export interface BusinessDocumentsOverview {
  readonly documents: BusinessDocumentView[];
  readonly overallStatus: "not_started" | "in_review" | "needs_attention" | "approved";
  readonly goldCheckmark: "after_approval" | "needs_plan" | "granted";
  readonly neverBlocksSelling: true;
}
