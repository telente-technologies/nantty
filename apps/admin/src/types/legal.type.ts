export type LegalDocumentKey = "terms" | "privacy" | "cookies" | "community-guidelines" | "seller-terms" | "creator-terms" | "ads-policy" | "refund-escrow-policy";
export type LegalVersionStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "SUPERSEDED";
export type LegalNoticeStatus = "QUEUED" | "SENDING" | "COMPLETED";

export interface LegalVersion {
  readonly id: string;
  readonly documentKey: LegalDocumentKey;
  readonly versionNumber: number;
  readonly status: LegalVersionStatus;
  readonly bodyMarkdown: string;
  readonly changeSummary: string;
  readonly effectiveAt: string;
  readonly isMaterialChange: boolean;
  readonly isFlaggedForLegalReview: boolean;
  readonly createdByName: string;
  readonly createdAt: string;
  readonly submittedByName: string | null;
  readonly submittedAt: string | null;
  readonly publishedByName: string | null;
  readonly publishedAt: string | null;
  readonly returnedReason: string | null;
  readonly rolledBackFromVersionNumber: number | null;
  readonly noticeId: string | null;
}

export interface LegalDocumentSummary {
  readonly key: LegalDocumentKey;
  readonly title: string;
  readonly publicPath: string;
  readonly currentVersion: LegalVersion | null;
  readonly openVersion: LegalVersion | null;
  readonly versionCount: number;
}

export interface LegalDocumentDetail {
  readonly document: LegalDocumentSummary;
  readonly versions: readonly LegalVersion[];
}

export interface LegalVersionInput {
  readonly bodyMarkdown: string;
  readonly changeSummary: string;
  readonly effectiveAt: string;
  readonly isMaterialChange: boolean;
}

export interface LegalNoticeProgress {
  readonly id: string;
  readonly documentKey: LegalDocumentKey;
  readonly documentTitle: string;
  readonly versionId: string;
  readonly versionNumber: number;
  readonly subject: string;
  readonly status: LegalNoticeStatus;
  readonly recipientCount: number;
  readonly sentCount: number;
  readonly excludedHardBounces: number;
  readonly excludedSuppressed: number;
  readonly batchSize: number;
  readonly ratePerSecond: number;
  readonly batchesTotal: number;
  readonly batchesDone: number;
  readonly queuedAt: string;
  readonly queuedByName: string;
  readonly estimatedCompletionAt: string | null;
  readonly provider: "AWS_SES";
}

export interface LegalNoticeDraft {
  readonly versionId: string;
  readonly documentTitle: string;
  readonly subject: string;
  readonly summaryText: string;
  readonly whatChanged: readonly string[];
  readonly effectiveAt: string;
  readonly reacceptNote: string | null;
  readonly documentUrl: string;
  readonly updatedByName: string | null;
  readonly updatedAt: string | null;
  readonly testSends: readonly { readonly sentToEmail: string; readonly sentByName: string; readonly sentAt: string }[];
}

export interface LegalNoticeDraftInput {
  readonly subject: string;
  readonly summaryText: string;
  readonly whatChanged: readonly string[];
  readonly reacceptNote: string | null;
}

export interface LegalNoticePreview {
  readonly draft: LegalNoticeDraft;
  readonly subject: string;
  readonly totalUsers: number;
  readonly excludedHardBounces: number;
  readonly excludedSuppressed: number;
  readonly recipientCount: number;
  readonly batchSize: number;
  readonly ratePerSecond: number;
  readonly batchesTotal: number;
  readonly estimatedMinutes: number;
  readonly sendsWithoutMarketingConsent: true;
}

export interface LegalAcceptanceStats {
  readonly requiredCount: number;
  readonly acceptedCount: number;
  readonly mustAcceptBy: string | null;
}

export interface PublishLegalVersionInput {
  readonly reason: string;
  readonly acknowledgeShortNotice: boolean;
}
