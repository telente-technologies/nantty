import type { PlatformUserSummary } from "@/types/platformUser.type";

export type SecurityCaseStatus = "open" | "cleared" | "kept_restricted" | "suspended" | "banned" | "deleted";
export type SecurityCaseTrigger = "access_probing" | "suspected_bot";
export type SecurityCaseSeverity = "low" | "medium" | "high";
export type SecurityCaseAction = "clear" | "keep_restricted" | "suspend" | "ban" | "delete";
export type SecurityEventKind =
  | "access_violation" | "challenge_required" | "challenge_passed" | "challenge_failed" | "bot_score_recorded" | "bot_marked" | "bot_cleared"
  | "client_signals" | "auto_suspended" | "case_opened" | "case_decided";

export interface SecurityCaseDecision {
  readonly outcome: SecurityCaseStatus;
  readonly reason: string;
  readonly decidedById: string;
  readonly decidedByName: string;
  readonly decidedAt: string;
  readonly stepUp: boolean;
}

export interface SecurityCaseSummary {
  readonly id: string;
  readonly accountId: string;
  readonly account: PlatformUserSummary;
  readonly trigger: SecurityCaseTrigger;
  readonly status: SecurityCaseStatus;
  readonly severity: SecurityCaseSeverity;
  readonly violationCount: number;
  readonly failedChallengeCount: number;
  readonly passedChallengeCount: number;
  readonly autoSuspended: boolean;
  readonly openedAt: string;
  readonly lastActivityAt: string;
  readonly decidedAt: string | null;
  readonly decision: SecurityCaseDecision | null;
}

export interface SecurityTimelineEntry {
  readonly id: string;
  readonly kind: SecurityEventKind;
  readonly at: string;
  readonly deviceId: string;
  readonly ipPrefix: string;
  readonly source: string;
  readonly detail: Readonly<Record<string, unknown>> | null;
}

export interface SecurityCaseDetail extends SecurityCaseSummary {
  readonly state: {
    readonly challengeRequired: boolean;
    readonly suspectedBot: boolean;
    readonly botScore: number;
    readonly botReasons: readonly string[];
    readonly headlessReported: boolean;
    readonly attestationVerdict: string;
    readonly autoSuspendedAt: string | null;
  };
  readonly timeline: readonly SecurityTimelineEntry[];
  readonly challengeHistory: readonly SecurityTimelineEntry[];
  readonly linkedDevices: readonly string[];
  readonly linkedIpPrefixes: readonly string[];
  readonly previousCases: number;
  readonly automationNote: string;
}

export interface SecurityCaseFilters {
  readonly status?: "open" | "decided" | "all";
  readonly trigger?: SecurityCaseTrigger;
  readonly severity?: SecurityCaseSeverity;
  readonly cursor?: string;
}

export interface SecurityCaseDecisionInput {
  readonly action: SecurityCaseAction;
  readonly reason: string;
  readonly durationDays?: number;
  readonly features?: readonly string[];
  readonly confirmUsername?: string;
}
