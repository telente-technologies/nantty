import type { AuditLogEntry } from "@/types/audit.type";
import type { PlatformUserSummary } from "@/types/platformUser.type";

export type ReportTargetType = "POST" | "COMMENT" | "CLIP" | "LIVE" | "USER" | "PRODUCT" | "STORE" | "MESSAGE";
export type ReportStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED";
export type ReportPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type ReportReason = "SPAM" | "SCAM" | "HARASSMENT" | "HATE" | "NUDITY" | "VIOLENCE" | "COUNTERFEIT" | "IMPERSONATION" | "MISINFORMATION" | "SELF_HARM" | "OTHER";
export type ContentVisibility = "VISIBLE" | "HIDDEN" | "RESTRICTED" | "REMOVED";
export type ContentModerationAction = "DISMISS" | "HIDE" | "RESTRICT" | "REMOVE" | "WARN_AUTHOR";
export type AuthorModerationAction = "SUSPEND_AUTHOR" | "REVOKE_AUTHOR_VERIFICATION";
export type ModerationAction = ContentModerationAction | AuthorModerationAction;

export interface ModeratedTargetPreview {
  readonly type: ReportTargetType | "SOUND";
  readonly id: string;
  readonly title: string | null;
  readonly text: string | null;
  readonly mediaUrls: readonly string[];
  readonly soundTitle: string | null;
  readonly visibility: ContentVisibility;
  readonly createdAt: string;
}

export interface ClassifierScore {
  readonly label: string;
  readonly score: number;
}

export interface ReportReasonCount {
  readonly reason: ReportReason;
  readonly count: number;
}

export interface ModerationDecision {
  readonly action: ModerationAction;
  readonly reason: string;
  readonly decidedByName: string;
  readonly decidedAt: string;
  readonly suspensionDays: number | null;
}

export interface ReportSummary {
  readonly id: string;
  readonly target: ModeratedTargetPreview;
  readonly author: PlatformUserSummary;
  readonly primaryReason: ReportReason;
  readonly reasonCounts: readonly ReportReasonCount[];
  readonly reportCount: number;
  readonly priority: ReportPriority;
  readonly status: ReportStatus;
  readonly firstReportedAt: string;
  readonly lastReportedAt: string;
  readonly slaDueAt: string;
}

export interface ReporterNote {
  readonly reporterUsername: string;
  readonly note: string;
  readonly reportedAt: string;
}

export interface PriorAuthorAction {
  readonly action: string;
  readonly reason: string;
  readonly occurredAt: string;
}

export interface ReportDetail extends ReportSummary {
  readonly reporterNotes: readonly ReporterNote[];
  readonly classifierScores: readonly ClassifierScore[];
  readonly priorActionsOnAuthor: readonly PriorAuthorAction[];
  readonly decision: ModerationDecision | null;
  readonly history: readonly AuditLogEntry[];
}

export type AppealStatus = "PENDING" | "UPHELD" | "OVERTURNED";
export type AppealedDecisionType = "CONTENT_REMOVED" | "CONTENT_RESTRICTED" | "STRIKE" | "SUSPENSION" | "COPYRIGHT_TAKEDOWN";

export interface AppealSummary {
  readonly id: string;
  readonly appellant: PlatformUserSummary;
  readonly decisionType: AppealedDecisionType;
  readonly originalDecision: { readonly action: string; readonly reason: string; readonly decidedByName: string; readonly decidedAt: string; readonly reportId: string | null };
  readonly target: ModeratedTargetPreview;
  readonly userStatement: string;
  readonly evidenceNotes: readonly string[];
  readonly status: AppealStatus;
  readonly submittedAt: string;
  readonly slaDueAt: string;
}

export interface AppealDetail extends AppealSummary {
  readonly decision: { readonly outcome: "UPHELD" | "OVERTURNED"; readonly reason: string; readonly decidedByName: string; readonly decidedAt: string } | null;
  readonly history: readonly AuditLogEntry[];
}
