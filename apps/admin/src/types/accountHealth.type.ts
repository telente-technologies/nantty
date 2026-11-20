export type AccountStanding = "GOOD_STANDING" | "AT_RISK" | "RESTRICTED";

export interface AccountHealthStrike {
  readonly id: string;
  readonly kind: "STRIKE" | "WARNING";
  readonly policy: string;
  readonly reason: string;
  readonly source: string;
  readonly issuedAt: string;
  readonly expiresAt: string | null;
  readonly appealStatus: "NONE" | "PENDING" | "UPHELD" | "OVERTURNED";
  readonly claimId: string | null;
  readonly affectedContent: { readonly type: string; readonly id: string } | null;
}

export interface AccountHealthNotice {
  readonly claimId: string;
  readonly remedy: string;
  readonly state: string;
  readonly content: { readonly type: string; readonly id: string };
  readonly workTitle: string;
  readonly deadlineAt: string | null;
  readonly counterNoticeStatus: string | null;
}

export interface AccountHealthSummary {
  readonly accountId: string;
  readonly status: AccountStanding;
  readonly restrictions: readonly string[];
  readonly canMonetise: boolean;
  readonly canGoLive: boolean;
  readonly needsSuspensionReview: boolean;
  readonly activeStrikeCount: number;
  readonly copyrightStrikesInWindow: number;
  readonly pendingTakedownCount: number;
  readonly restrictionThreshold: number;
  readonly strikeWindowDays: number;
  readonly warnings: readonly AccountHealthStrike[];
  readonly strikes: readonly AccountHealthStrike[];
  readonly notices: readonly AccountHealthNotice[];
  readonly monetisationOverride?: MonetisationOverrideInfo | null;
}

export interface MonetisationOverrideInfo {
  readonly mode: "ALLOW" | "PAUSE";
  readonly reason: string;
  readonly actorId: string;
  readonly actorName: string;
  readonly activeStrikeCountAtOverride: number;
  readonly setAt: string;
}
