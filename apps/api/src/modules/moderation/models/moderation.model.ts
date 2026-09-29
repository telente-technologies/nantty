import type { ModerationTargetType } from "../../../interfaces/moderationTargets.interface.js";

export const REPORT_REASONS = [
  "spam",
  "scam_or_fraud",
  "counterfeit_product",
  "nudity_or_sexual_content",
  "hate_or_harassment",
  "violence",
  "intellectual_property",
  "something_else",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export type ReportStatus = "received" | "reviewing" | "action_taken" | "no_violation";
export type CaseStatus = "open" | "actioned" | "dismissed";
export type CaseSource = "report" | "automation";
export const MODERATION_ACTIONS = ["hide", "remove", "warn", "suspend", "revoke_verification", "dismiss"] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];
export type AppealStatus = "pending" | "upheld" | "overturned";

export interface ReportRecord {
  readonly id: string;
  readonly reporterId: string;
  readonly targetType: ModerationTargetType;
  readonly targetId: string;
  readonly reason: ReportReason;
  readonly details: string;
  readonly caseId: string;
  readonly status: ReportStatus;
  readonly outcomeNote: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type NewReport = Omit<ReportRecord, "id" | "status" | "outcomeNote" | "createdAt" | "updatedAt">;

export interface CaseRecord {
  readonly id: string;
  readonly targetType: ModerationTargetType;
  readonly targetId: string;
  readonly targetOwnerId: string | null;
  readonly targetSummary: string;
  readonly status: CaseStatus;
  readonly priority: number;
  readonly reportCount: number;
  readonly source: CaseSource;
  readonly flaggedReason: string | null;
  readonly autoHidden: boolean;
  readonly resolvedById: string | null;
  readonly resolvedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type NewCase = Pick<CaseRecord, "targetType" | "targetId" | "targetOwnerId" | "targetSummary" | "priority" | "source" | "flaggedReason">;
export type CaseChanges = Partial<Pick<CaseRecord, "status" | "priority" | "flaggedReason" | "autoHidden" | "resolvedById" | "resolvedAt">>;

export interface DecisionRecord {
  readonly id: string;
  readonly caseId: string;
  readonly targetType: ModerationTargetType;
  readonly targetId: string;
  readonly affectedUserId: string | null;
  readonly action: ModerationAction;
  readonly reason: string;
  readonly actorId: string | null;
  readonly suspensionEndsAt: Date | null;
  readonly reversedAt: Date | null;
  readonly createdAt: Date;
}

export type NewDecision = Omit<DecisionRecord, "id" | "reversedAt" | "createdAt">;

export interface AppealRecord {
  readonly id: string;
  readonly decisionId: string;
  readonly appellantId: string;
  readonly statement: string;
  readonly status: AppealStatus;
  readonly reviewerId: string | null;
  readonly reviewNote: string | null;
  readonly createdAt: Date;
  readonly resolvedAt: Date | null;
}

export interface SuspensionRecord {
  readonly id: string;
  readonly userId: string;
  readonly decisionId: string;
  readonly endsAt: Date | null;
  readonly liftedAt: Date | null;
  readonly createdAt: Date;
}

export function createOpenCaseKey(targetType: ModerationTargetType, targetId: string): string {
  return `${targetType}:${targetId}`;
}

export function isSuspensionActive(suspension: SuspensionRecord, now: Date): boolean {
  return suspension.liftedAt === null && (suspension.endsAt === null || suspension.endsAt > now);
}
