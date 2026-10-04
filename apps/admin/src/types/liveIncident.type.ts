import type { AuditLogEntry } from "@/types/audit.type";

export type LiveIncidentPriority = "urgent" | "high" | "normal" | "low";
export type LiveIncidentStatus = "open" | "closed";
export type LiveIncidentAction = "keep_live" | "keep_paused" | "end_live" | "end_and_suspend";

export interface LiveIncidentHost {
  readonly id: string;
  readonly username?: string;
  readonly displayName?: string;
  readonly avatarUrl?: string | null;
}

export interface LiveIncidentSummary {
  readonly id: string;
  readonly liveId: string;
  readonly host: LiveIncidentHost;
  readonly status: LiveIncidentStatus;
  readonly priority: LiveIncidentPriority;
  readonly holdActive: boolean;
  readonly holdCategory: string;
  readonly holdSource: string;
  readonly holdStartedAt: string | null;
  readonly topCategory: string;
  readonly topConfidence: number;
  readonly reportCount: number;
  readonly warningCount: number;
  readonly hashMatch: boolean;
  readonly appealed: boolean;
  readonly liveEnded: boolean;
  readonly resolution: string;
  readonly slaDueAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly latestFrameUrl: string | null;
}

export interface LiveIncidentLabel {
  readonly name: string;
  readonly parentName: string;
  readonly confidence: number;
}

export interface LiveIncidentCategory {
  readonly category: string;
  readonly confidence: number;
}

export interface LiveIncidentFrame {
  readonly id: string;
  readonly frameRef: string;
  readonly previewUrl: string | null;
  readonly restricted: boolean;
  readonly capturedAt: string | null;
  readonly labels: readonly LiveIncidentLabel[];
  readonly categories: readonly LiveIncidentCategory[];
  readonly confidence: number;
  readonly actionTaken: string;
  readonly modelVersion: string;
}

export interface LiveIncidentTranscript {
  readonly id: string;
  readonly snippet: string;
  readonly categories: readonly LiveIncidentCategory[];
  readonly confidence: number;
  readonly createdAt: string;
}

export interface LiveIncidentReport {
  readonly id: string;
  readonly reason: string;
  readonly details: string;
  readonly offsetSeconds: number | null;
  readonly frameRef: string;
  readonly reporterId: string | null;
  readonly createdAt: string;
}

export interface LiveIncidentDecision {
  readonly action: LiveIncidentAction;
  readonly reason: string;
  readonly decidedByName: string;
  readonly decidedAt: string;
  readonly suspensionDays: number | null;
}

export interface LiveIncidentDetail extends LiveIncidentSummary {
  readonly holdReason: string;
  readonly appealedAt: string | null;
  readonly appealMessage: string;
  readonly latestFrames: readonly LiveIncidentFrame[];
  readonly flaggedFrames: readonly LiveIncidentFrame[];
  readonly transcripts: readonly LiveIncidentTranscript[];
  readonly reports: readonly LiveIncidentReport[];
  readonly decision: LiveIncidentDecision | null;
  readonly history: readonly AuditLogEntry[];
}
