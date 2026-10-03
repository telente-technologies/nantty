import type { MailKind } from "./notification.type.js";

export type CampaignKind = "ADMIN_EMAIL" | "POLICY_NOTICE";
export type CampaignStatus = "QUEUED" | "SENDING" | "COMPLETED";
export type AudienceKind = "USER" | "SEGMENT";

export interface PolicyNoticePayload {
  readonly policyName: string;
  readonly subjectLine: string;
  readonly summary: string;
  readonly changes: readonly string[];
  readonly effectiveAt: string;
  readonly requiresReacceptance: boolean;
  readonly policyUrl: string;
  readonly acceptUrl?: string;
  readonly reacceptNote?: string;
}

export interface AdminEmailPayload {
  readonly body: string;
}

export interface Campaign {
  readonly id: string;
  readonly kind: CampaignKind;
  readonly status: CampaignStatus;
  readonly subject: string;
  readonly payload: PolicyNoticePayload | AdminEmailPayload;
  readonly audienceKind: AudienceKind;
  readonly audienceLabel: string;
  readonly audienceRef: string;
  readonly mailKind: MailKind;
  readonly recipientCount: number;
  readonly sentCount: number;
  readonly skippedNoMarketingConsent: number;
  readonly skippedHardBounces: number;
  readonly skippedSuppressed: number;
  readonly failedCount: number;
  readonly batchSize: number;
  readonly ratePerSecond: number;
  readonly batchesTotal: number;
  readonly batchesDone: number;
  readonly nextCursor: string | null;
  readonly reason: string | null;
  readonly queuedById: string;
  readonly queuedByName: string;
  readonly versionId: string | null;
  readonly createdAt: Date;
  readonly completedAt: Date | null;
}

export type NewCampaign = Omit<Campaign, "id" | "status" | "sentCount" | "failedCount" | "batchesDone" | "nextCursor" | "createdAt" | "completedAt">;

export interface BatchProgress {
  readonly sentCount: number;
  readonly failedCount: number;
  readonly nextCursor: string | null;
}

export interface NoticeDraft {
  readonly versionId: string;
  readonly documentKey: string;
  readonly documentTitle: string;
  readonly versionNumber: number;
  readonly subject: string;
  readonly summaryText: string;
  readonly whatChanged: readonly string[];
  readonly effectiveAt: Date;
  readonly reacceptNote: string | null;
  readonly requiresReacceptance: boolean;
  readonly documentUrl: string;
  readonly updatedByName: string | null;
  readonly updatedAt: Date;
  readonly testSends: readonly { readonly sentToEmail: string; readonly sentByName: string; readonly sentAt: string }[];
}
