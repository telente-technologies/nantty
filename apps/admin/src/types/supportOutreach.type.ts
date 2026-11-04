import type { AuditLogEntry } from "@/types/audit.type";
import type { PlatformUserSummary } from "@/types/platformUser.type";
import type { SupportAgent, SupportMessage } from "@/types/support.type";

export type LiveChatStatus = "WAITING" | "ACTIVE" | "ENDED";

export interface LiveChatSummary {
  readonly id: string;
  readonly user: PlatformUserSummary;
  readonly status: LiveChatStatus;
  readonly assignee: SupportAgent | null;
  readonly startedAt: string;
  readonly lastMessageAt: string;
  readonly lastMessagePreview: string;
  readonly topic: string;
}

export interface LiveChatDetail {
  readonly chat: LiveChatSummary;
  readonly messages: readonly SupportMessage[];
  readonly isRecorded: true;
  readonly isEndToEndEncrypted: false;
  readonly history: readonly AuditLogEntry[];
}

export type EmailKind = "TRANSACTIONAL" | "MARKETING";

export interface EmailTemplate {
  readonly id: string;
  readonly name: string;
  readonly kind: EmailKind;
  readonly subject: string;
  readonly body: string;
}

export interface EmailSegment {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly recipientCount: number;
  readonly marketingConsentCount: number;
}

export type EmailAudience = { readonly type: "USER"; readonly username: string } | { readonly type: "SEGMENT"; readonly segmentId: string };

export interface EmailDraftInput {
  readonly kind: EmailKind;
  readonly subject: string;
  readonly body: string;
  readonly audience: EmailAudience;
}

export interface EmailPreview {
  readonly recipientCount: number;
  readonly skippedNoMarketingConsent: number;
  readonly includesUnsubscribeLink: boolean;
  readonly renderedSubject: string;
  readonly renderedBody: string;
  readonly provider: "AWS_SES";
}

export interface EmailSendRecord {
  readonly id: string;
  readonly kind: EmailKind;
  readonly subject: string;
  readonly audienceLabel: string;
  readonly recipientCount: number;
  readonly skippedNoMarketingConsent: number;
  readonly sentByName: string;
  readonly sentAt: string;
  readonly provider: "AWS_SES";
}

export interface FailedEmailDeliveryRecord {
  readonly id: string;
  readonly eventId: string;
  readonly templateKey: string | null;
  readonly attemptCount: number;
  readonly failedAt: string | null;
  readonly reason: string | null;
}
