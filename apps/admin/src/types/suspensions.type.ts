import type { AuditLogEntry } from "@/types/audit.type";
import type { PlatformUserSummary } from "@/types/platformUser.type";

export type SuspensionCaseSource = "PYTHON_SUGGESTION" | "USER_REPORTS" | "COPYRIGHT_STRIKES";
export type SuspensionCaseStatus = "PENDING" | "ESCALATED" | "SUSPENDED" | "DISMISSED";
export type SuspensionReasonCode = "FRAUD" | "SCAM" | "COUNTERFEIT" | "HARASSMENT" | "IMPERSONATION" | "SPAM_NETWORK" | "OTHER";
export type SuspensionAppealStatus = "PENDING" | "UPHELD" | "OVERTURNED";

export interface SuspensionSignal {
  readonly label: string;
  readonly weight: number;
  readonly detail: string;
}

export interface SuspensionEvidenceLink {
  readonly label: string;
  readonly href: string;
}

export interface SuspensionUserReport {
  readonly id: string;
  readonly reason: string;
  readonly excerpt: string;
  readonly reportedAt: string;
}

export interface SuspensionCaseSummary {
  readonly id: string;
  readonly user: PlatformUserSummary;
  readonly source: SuspensionCaseSource;
  readonly status: SuspensionCaseStatus;
  readonly riskScore: number;
  readonly topSignals: readonly string[];
  readonly reportCount: number;
  readonly createdAt: string;
}

export interface SuspensionDecision {
  readonly outcome: "SUSPENDED" | "DISMISSED" | "ESCALATED";
  readonly reasonCode: SuspensionReasonCode | null;
  readonly reason: string;
  readonly decidedByName: string;
  readonly decidedAt: string;
}

export interface SuspensionCaseDetail extends SuspensionCaseSummary {
  readonly signals: readonly SuspensionSignal[];
  readonly evidence: readonly SuspensionEvidenceLink[];
  readonly reports: readonly SuspensionUserReport[];
  readonly modelVersion: string;
  readonly decision: SuspensionDecision | null;
  readonly history: readonly AuditLogEntry[];
}

export interface SuspensionAppeal {
  readonly id: string;
  readonly status: SuspensionAppealStatus;
  readonly message: string;
  readonly submittedAt: string;
  readonly decisionNote: string | null;
}

export interface SuspendedAccount {
  readonly caseId: string;
  readonly user: PlatformUserSummary;
  readonly reasonCode: SuspensionReasonCode;
  readonly note: string;
  readonly suspendedAt: string;
  readonly suspendedByName: string;
  readonly deletionDueAt: string;
  readonly daysUntilDeletion: number;
  readonly appeal: SuspensionAppeal | null;
}

export interface SuspensionQueueFilters {
  readonly status?: string;
  readonly source?: string;
  readonly search?: string;
  readonly cursor?: string;
}

export interface SuspendedAccountFilters {
  readonly appeal?: string;
  readonly search?: string;
  readonly cursor?: string;
}
