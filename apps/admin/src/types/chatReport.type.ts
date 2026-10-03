import type { AuditLogEntry } from "@/types/audit.type";
import type { ReportPriority } from "@/types/moderation.type";
import type { PlatformUserSummary } from "@/types/platformUser.type";

export type ChatReportTargetType = "USER" | "MESSAGE" | "CONVERSATION" | "GROUP";
export type ChatReportStatus = "OPEN" | "IN_REVIEW" | "ACTIONED" | "DISMISSED" | "ESCALATED_LEGAL";
export type ChatReportReason =
  | "SPAM_OR_SCAM"
  | "HARASSMENT_OR_BULLYING"
  | "HATE"
  | "SEXUAL_CONTENT"
  | "CHILD_SAFETY"
  | "VIOLENCE_OR_THREATS"
  | "IMPERSONATION"
  | "PROHIBITED_ITEMS"
  | "FRAUD_OR_PAYMENT_SCAM"
  | "SELF_HARM"
  | "OTHER";
export type ChatReportAction = "DISMISS" | "WARN_USER" | "RESTRICT_USER" | "SUSPEND_USER" | "BAN_USER" | "REMOVE_GROUP" | "ESCALATE_LEGAL";
export type ReporterOutcome = "TOOK_ACTION" | "NO_VIOLATION";

export interface ChatEvidenceAttachment {
  readonly type: string;
  readonly mimeType: string | null;
  readonly fileName: string | null;
  readonly sizeBytes: number | null;
  readonly durationSeconds: number | null;
}

export interface ChatEvidenceMessage {
  readonly messageId: string;
  readonly senderId: string;
  readonly senderName: string;
  readonly isReportedUser: boolean;
  readonly sentAt: string;
  readonly text: string;
  readonly attachments: readonly ChatEvidenceAttachment[];
}

export interface ChatReportSpamScore {
  readonly score: number;
  readonly signals: readonly string[];
  readonly source: string;
}

export interface ChatReportSummary {
  readonly id: string;
  readonly targetType: ChatReportTargetType;
  readonly reason: ChatReportReason;
  readonly priority: ReportPriority;
  readonly status: ChatReportStatus;
  readonly reporter: PlatformUserSummary;
  readonly reportedUser: PlatformUserSummary | null;
  readonly conversationLabel: string;
  readonly createdAt: string;
  readonly slaDueAt: string;
  readonly evidenceCount: number;
  readonly spamScore: ChatReportSpamScore | null;
  readonly isLegalReview: boolean;
}

export interface ChatReportDecision {
  readonly chatAction: ChatReportAction;
  readonly reason: string;
  readonly decidedByName: string;
  readonly decidedAt: string;
  readonly suspensionDays: number | null;
}

export interface ChatReportDetail extends ChatReportSummary {
  readonly details: string;
  readonly evidenceSelection: "last_messages" | "picked_messages" | null;
  readonly evidenceHash: string | null;
  readonly isEvidenceHashVerified: boolean;
  readonly evidenceRetainedUntil: string | null;
  readonly reporterBlockedReportedUser: boolean;
  readonly transcript: readonly ChatEvidenceMessage[];
  readonly decision: ChatReportDecision | null;
  readonly reporterOutcome: ReporterOutcome | null;
  readonly history: readonly AuditLogEntry[];
}

export interface ChatEvidenceRetentionSettings {
  readonly retentionDays: number;
  readonly legalHoldDays: number;
  readonly label: "LEGAL REVIEW";
}
