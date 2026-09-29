import type { AuditLogEntry } from "@/types/audit.type";
import type { ModeratedTargetPreview } from "@/types/moderation.type";
import type { PlatformUserSummary } from "@/types/platformUser.type";

export type CopyrightClaimStatus = "PENDING" | "NEEDS_INFO" | "UPHELD" | "REJECTED" | "COUNTER_NOTICE" | "RESTORED";
export type CopyrightTargetFlag = "VISIBLE" | "LIMITED" | "TAKEN_DOWN";
export type CounterNoticeStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface CopyrightClaimant {
  readonly name: string;
  readonly organization: string | null;
  readonly email: string;
  readonly representativeOf: string | null;
}

export interface CopyrightClaimSummary {
  readonly id: string;
  readonly claimant: CopyrightClaimant;
  readonly workTitle: string;
  readonly workType: "SOUND" | "VIDEO" | "IMAGE" | "TEXT";
  readonly target: ModeratedTargetPreview;
  readonly infringer: PlatformUserSummary;
  readonly targetFlag: CopyrightTargetFlag;
  readonly status: CopyrightClaimStatus;
  readonly filedAt: string;
  readonly topAudioMatchConfidencePercent: number | null;
  readonly infringerStrikeCount: number;
}

export interface AudioMatchSegment {
  readonly targetStartSeconds: number;
  readonly targetEndSeconds: number;
  readonly referenceStartSeconds: number;
}

export interface AudioMatchHint {
  readonly matchedTrack: string;
  readonly artist: string;
  readonly confidencePercent: number;
  readonly segments: readonly AudioMatchSegment[];
  readonly source: string;
}

export interface CounterNotice {
  readonly id: string;
  readonly submittedAt: string;
  readonly statement: string;
  readonly status: CounterNoticeStatus;
  readonly restoreEligibleAt: string;
}

export interface CopyrightClaimDetail extends CopyrightClaimSummary {
  readonly rightsBasis: string;
  readonly swornStatement: string;
  readonly claimedUrls: readonly string[];
  readonly audioMatches: readonly AudioMatchHint[];
  readonly counterNotices: readonly CounterNotice[];
  readonly repeatInfringerThreshold: number;
  readonly decision: { readonly outcome: string; readonly reason: string; readonly decidedByName: string; readonly decidedAt: string } | null;
  readonly history: readonly AuditLogEntry[];
}
