import type { PlatformUserSummary } from "@/types/platformUser.type";

export type BusinessDocumentKind = "CAC_CERTIFICATE" | "ID" | "PROOF_OF_ADDRESS";
export type BusinessDocumentStatus = "PENDING" | "APPROVED" | "REJECTED";
export type BusinessDocumentStorePlan = "FREE" | "PRO" | "BUSINESS";

export interface BusinessDocumentItem {
  readonly id: string;
  readonly kind: BusinessDocumentKind;
  readonly fileName: string;
  readonly uploadedAt: string;
  readonly status: BusinessDocumentStatus;
  readonly rejectionReason: string | null;
  readonly reviewedByName: string | null;
  readonly reviewedAt: string | null;
}

export interface BusinessDocumentSubmission {
  readonly id: string;
  readonly user: PlatformUserSummary;
  readonly storeName: string;
  readonly plan: BusinessDocumentStorePlan;
  readonly overallStatus: BusinessDocumentStatus;
  readonly submittedAt: string;
  readonly documents: readonly BusinessDocumentItem[];
  readonly goldCheckmark: "GRANTED" | "WAITING_FOR_PLAN" | "NOT_YET";
}

export interface BusinessDocumentAccess {
  readonly documentId: string;
  readonly fileName: string;
  readonly viewUrl: string;
  readonly expiresAt: string;
  readonly watermarkText: string;
}

export interface BusinessDocumentFilters {
  readonly status?: string;
  readonly search?: string;
  readonly cursor?: string;
}
