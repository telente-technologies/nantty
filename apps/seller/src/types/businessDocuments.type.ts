export type BusinessDocumentKind = "cac_certificate" | "identity" | "address_proof";
export type BusinessDocumentStatus = "not_uploaded" | "pending" | "approved" | "rejected";

export interface BusinessDocumentRecord {
  readonly kind: BusinessDocumentKind;
  readonly label: string;
  readonly status: BusinessDocumentStatus;
  readonly fileUrl: string | null;
  readonly rejectionReason: string | null;
  readonly submittedAt: string | null;
}

export interface BusinessDocumentsResponse {
  readonly documents: BusinessDocumentRecord[];
  readonly allApproved: boolean;
}

export interface BusinessDocumentUploadIntent {
  readonly documentId: string;
  readonly objectKey: string;
  readonly uploadUrl: string;
  readonly headers: Record<string, string>;
  readonly expiresAt: string;
}

export interface BusinessDocumentView extends BusinessDocumentRecord {
  readonly description: string;
}

export interface BusinessDocumentsOverview {
  readonly documents: BusinessDocumentView[];
  readonly overallStatus: "not_started" | "in_review" | "needs_attention" | "approved";
  readonly goldCheckmark: "after_approval" | "needs_plan" | "granted";
}
