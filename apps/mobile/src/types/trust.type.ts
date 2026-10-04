import type { ID, ISODate } from "./models.type";

export interface SuspensionNotice {
  readonly reason: string;
  readonly suspendedAt: ISODate;
  readonly deletionScheduledFor: ISODate;
  readonly retentionDays: number;
}

export interface CheckmarkRule {
  readonly label: string;
  readonly met: boolean;
}

export interface CheckmarkSuggestion {
  readonly color: "blue" | "gold";
  readonly eligible: boolean;
  readonly dismissed: boolean;
  readonly headline: string;
  readonly detail: string;
  readonly rules: readonly CheckmarkRule[];
}

export type BusinessDocumentKind = "cac_certificate" | "identity" | "address_proof";
export type BusinessDocumentStatus = "not_uploaded" | "pending" | "approved" | "rejected";

export interface BusinessDocument {
  readonly kind: BusinessDocumentKind;
  readonly label: string;
  readonly status: BusinessDocumentStatus;
  readonly fileUrl: string | null;
  readonly rejectionReason: string | null;
  readonly submittedAt: ISODate | null;
}

export interface BusinessDocumentsState {
  readonly documents: readonly BusinessDocument[];
  readonly allApproved: boolean;
}

export type MarketingFrequency = "weekly" | "important_only" | "off";

export interface MarketingPreferences {
  readonly frequency: MarketingFrequency;
}
