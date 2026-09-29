import type { AppealRecord, CaseRecord, DecisionRecord, ReportRecord } from "../models/moderation.model.js";

export interface ContentReportDto {
  readonly id: string;
  readonly targetType: ReportRecord["targetType"];
  readonly targetId: string;
  readonly targetLabel: string;
  readonly reason: string;
  readonly status: ReportRecord["status"];
  readonly outcomeNote: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AppealDto {
  readonly id: string;
  readonly decisionId: string;
  readonly appellantId: string;
  readonly statement: string;
  readonly status: AppealRecord["status"];
  readonly reviewNote: string | null;
  readonly createdAt: string;
  readonly resolvedAt: string | null;
}

export interface DecisionDto {
  readonly id: string;
  readonly caseId: string;
  readonly targetType: DecisionRecord["targetType"];
  readonly targetId: string;
  readonly action: DecisionRecord["action"];
  readonly reason: string;
  readonly automated: boolean;
  readonly suspensionEndsAt: string | null;
  readonly reversed: boolean;
  readonly createdAt: string;
  readonly appeal: AppealDto | null;
}

export interface ModerationCaseDto {
  readonly id: string;
  readonly targetType: CaseRecord["targetType"];
  readonly targetId: string;
  readonly targetOwnerId: string | null;
  readonly targetSummary: string;
  readonly status: CaseRecord["status"];
  readonly priority: number;
  readonly reportCount: number;
  readonly source: CaseRecord["source"];
  readonly flaggedReason: string | null;
  readonly autoHidden: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ModerationCaseDetailDto extends ModerationCaseDto {
  readonly reports: readonly { readonly id: string; readonly reporterId: string; readonly reason: string; readonly details: string; readonly createdAt: string }[];
  readonly decisions: readonly DecisionDto[];
}

export function convertReportToDto(report: ReportRecord, targetLabel: string): ContentReportDto {
  return {
    id: report.id,
    targetType: report.targetType,
    targetId: report.targetId,
    targetLabel,
    reason: report.reason,
    status: report.status,
    outcomeNote: report.outcomeNote,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
}

export function convertAppealToDto(appeal: AppealRecord): AppealDto {
  return {
    id: appeal.id,
    decisionId: appeal.decisionId,
    appellantId: appeal.appellantId,
    statement: appeal.statement,
    status: appeal.status,
    reviewNote: appeal.reviewNote,
    createdAt: appeal.createdAt.toISOString(),
    resolvedAt: appeal.resolvedAt?.toISOString() ?? null,
  };
}

export function convertDecisionToDto(decision: DecisionRecord, appeal: AppealRecord | undefined): DecisionDto {
  return {
    id: decision.id,
    caseId: decision.caseId,
    targetType: decision.targetType,
    targetId: decision.targetId,
    action: decision.action,
    reason: decision.reason,
    automated: decision.actorId === null,
    suspensionEndsAt: decision.suspensionEndsAt?.toISOString() ?? null,
    reversed: decision.reversedAt !== null,
    createdAt: decision.createdAt.toISOString(),
    appeal: appeal === undefined ? null : convertAppealToDto(appeal),
  };
}

export function convertCaseToDto(caseRecord: CaseRecord): ModerationCaseDto {
  return {
    id: caseRecord.id,
    targetType: caseRecord.targetType,
    targetId: caseRecord.targetId,
    targetOwnerId: caseRecord.targetOwnerId,
    targetSummary: caseRecord.targetSummary,
    status: caseRecord.status,
    priority: caseRecord.priority,
    reportCount: caseRecord.reportCount,
    source: caseRecord.source,
    flaggedReason: caseRecord.flaggedReason,
    autoHidden: caseRecord.autoHidden,
    createdAt: caseRecord.createdAt.toISOString(),
    updatedAt: caseRecord.updatedAt.toISOString(),
  };
}
