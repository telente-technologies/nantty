import type { AuditLogEntry } from "@/types/audit.type";
import type { ModeratedTargetPreview } from "@/types/moderation.type";
import type { PlatformUserSummary } from "@/types/platformUser.type";

export type CopyrightClaimStatus = "PENDING" | "NEEDS_INFO" | "UPHELD" | "REJECTED" | "COUNTER_NOTICE" | "RESTORED";
export type CopyrightTargetFlag = "VISIBLE" | "LIMITED" | "TAKEN_DOWN" | "MUTED" | "WARNED";
export type CopyrightClaimScope = "AUDIO" | "VIDEO";
export type CopyrightRemedy = "NONE" | "AUDIO_MUTED" | "TAKEDOWN_WARNING" | "TAKEN_DOWN";
export type CopyrightRemedyState = "NONE" | "MUTED" | "AWAITING_REMOVAL" | "REMOVED_VOLUNTARILY" | "TAKEN_DOWN" | "RESTORED";
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
  readonly claimScope?: CopyrightClaimScope;
  readonly remedy?: CopyrightRemedy;
  readonly remedyState?: CopyrightRemedyState;
  readonly takedownDeadlineAt?: string | null;
}

export interface CopyrightClaimEvidence {
  readonly originalWorkUrl: string | null;
  readonly originalWorkMediaId: string | null;
  readonly proofUrls: readonly string[];
  readonly proofMediaIds: readonly string[];
  readonly segments: readonly { readonly startSeconds: number; readonly endSeconds: number }[];
  readonly accuracyDeclared: boolean;
  readonly signatureName: string;
  readonly signedAt: string | null;
  readonly claimantPhone: string | null;
  readonly claimantAddress: string | null;
}

export interface CopyrightPolicySettings {
  readonly takedownDeadlineHours: number;
  readonly strikeLifetimeDays: number;
  readonly warningLifetimeDays: number;
  readonly strikeWindowDays: number;
  readonly restrictionThreshold: number;
  readonly suspensionReviewThreshold: number;
  readonly restrictionDays: number;
  readonly updatedBy?: string;
  readonly updatedAt?: string;
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
  readonly evidence?: CopyrightClaimEvidence;
  readonly repeatInfringerThreshold: number;
  readonly decision: { readonly outcome: string; readonly reason: string; readonly decidedByName: string; readonly decidedAt: string } | null;
  readonly history: readonly AuditLogEntry[];
}
