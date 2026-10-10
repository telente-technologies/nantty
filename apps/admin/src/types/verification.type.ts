import type { Money } from "@/types/api.type";
import type { AuditLogEntry } from "@/types/audit.type";
import type { PlatformUserSummary, VerificationColor, VerificationStatus, VerificationTier } from "@/types/platformUser.type";

export type VerificationTransition = "approve" | "reject" | "suspend" | "revoke" | "reinstate";
export type VerificationDocumentKind = "NATIONAL_ID" | "PASSPORT" | "DRIVERS_LICENCE" | "SELFIE" | "CAC_CERTIFICATE" | "UTILITY_BILL" | "GOVERNMENT_LETTER";

export interface VerificationDocumentSummary {
  readonly id: string;
  readonly kind: VerificationDocumentKind;
  readonly label: string;
  readonly uploadedAt: string;
}

export interface VerificationAutomatedCheck {
  readonly label: string;
  readonly result: "PASS" | "FAIL" | "REVIEW";
  readonly detail: string;
}

export interface VerificationApplicantDetails {
  readonly legalName: string;
  readonly category: string;
  readonly country: string;
  readonly businessName: string | null;
  readonly registrationNumber: string | null;
  readonly agencyName: string | null;
  readonly officialContactEmail: string | null;
}

export interface VerificationApplication {
  readonly id: string;
  readonly user: PlatformUserSummary;
  readonly color: VerificationColor;
  readonly tier: VerificationTier;
  readonly status: VerificationStatus;
  readonly subjectKind: "PERSON" | "BUSINESS" | "GOVERNMENT";
  readonly submittedAt: string;
  readonly reviewedAt: string | null;
  readonly reviewedByName: string | null;
  readonly decisionReason: string | null;
  readonly badgeVisibleWhenVerified: boolean;
  readonly grantsDashboardAccess: boolean;
  readonly subscription: { readonly planCode: string; readonly price: Money } | null;
  readonly applicant: VerificationApplicantDetails;
  readonly documents: readonly VerificationDocumentSummary[];
  readonly checks: readonly VerificationAutomatedCheck[];
  readonly allowedTransitions: readonly VerificationTransition[];
}

export interface VerificationApplicationDetail extends VerificationApplication {
  readonly history: readonly AuditLogEntry[];
}

export interface VerificationDocumentAccess {
  readonly documentId: string;
  readonly kind: VerificationDocumentKind;
  readonly label: string;
  readonly viewUrl: string;
  readonly expiresAt: string;
  readonly watermarkText: string;
}

export interface VerificationListFilters {
  readonly status?: string;
  readonly color?: string;
  readonly search?: string;
  readonly cursor?: string;
}
