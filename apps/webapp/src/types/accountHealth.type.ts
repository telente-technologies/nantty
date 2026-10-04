import type { ID, ISODate } from "./models.type";

export type AccountStanding = "GOOD_STANDING" | "AT_RISK" | "RESTRICTED";
export type AccountRestriction = "MONETISATION" | "GOING_LIVE";
export type CopyrightRemedy = "AUDIO_MUTED" | "TAKEDOWN_WARNING" | "TAKEN_DOWN";
export type CopyrightRemedyState = "MUTED" | "AWAITING_REMOVAL" | "REMOVED_VOLUNTARILY" | "TAKEN_DOWN" | "RESTORED" | "NONE";

export interface AccountContentReference {
  readonly type: "clip" | "post" | "sound" | "live";
  readonly id: ID;
}

export interface AccountStrike {
  readonly id: ID;
  readonly kind: "STRIKE" | "WARNING";
  readonly policy: string;
  readonly reason: string;
  readonly source: string;
  readonly issuedAt: ISODate;
  readonly expiresAt: ISODate | null;
  readonly status: "ACTIVE" | "INACTIVE";
  readonly appealStatus: "NONE" | "PENDING" | "UPHELD" | "OVERTURNED";
  readonly canAppeal: boolean;
  readonly claimId: ID | null;
  readonly affectedContent: AccountContentReference | null;
}

export interface CopyrightNotice {
  readonly claimId: ID;
  readonly remedy: CopyrightRemedy;
  readonly state: CopyrightRemedyState;
  readonly content: AccountContentReference;
  readonly workTitle: string;
  readonly claimantName: string;
  readonly reason: string;
  readonly decidedAt: ISODate;
  readonly deadlineAt: ISODate | null;
  readonly canCounterNotice: boolean;
  readonly counterNoticeStatus: string | null;
}

export interface AccountHealth {
  readonly accountId: ID;
  readonly status: AccountStanding;
  readonly restrictions: readonly AccountRestriction[];
  readonly canMonetise: boolean;
  readonly canGoLive: boolean;
  readonly needsSuspensionReview: boolean;
  readonly activeStrikeCount: number;
  readonly copyrightStrikesInWindow: number;
  readonly pendingTakedownCount: number;
  readonly restrictionThreshold: number;
  readonly strikeWindowDays: number;
  readonly strikeLifetimeDays: number;
  readonly takedownDeadlineHours: number;
  readonly warnings: readonly AccountStrike[];
  readonly strikes: readonly AccountStrike[];
  readonly notices: readonly CopyrightNotice[];
  readonly helpLinks: readonly { readonly label: string; readonly href: string }[];
  readonly generatedAt: ISODate;
}

export interface CounterNoticeInput {
  readonly statement: string;
  readonly contactEmail: string;
  readonly goodFaith: true;
}
