export type AccountStanding = "GOOD_STANDING" | "AT_RISK" | "RESTRICTED";

export interface HealthStrike {
  readonly id: string;
  readonly kind: string;
  readonly policy: string;
  readonly reason: string;
  readonly source: string;
  readonly issuedAt: string;
  readonly expiresAt: string | null;
  readonly status: string;
  readonly appealStatus: string;
  readonly canAppeal: boolean;
  readonly claimId: string | null;
}

export interface TakedownNotice {
  readonly claimId: string;
  readonly remedy?: string;
  readonly state: string;
  readonly workTitle?: string;
  readonly deadlineAt: string | null;
  readonly canCounterNotice?: boolean;
}

export interface AccountHealthSummary {
  readonly status: AccountStanding;
  readonly restrictions: readonly string[];
  readonly canMonetise: boolean;
  readonly canGoLive: boolean;
  readonly activeStrikeCount: number;
  readonly copyrightStrikesInWindow?: number;
  readonly restrictionThreshold: number;
  readonly suspensionReviewThreshold?: number;
  readonly strikeWindowDays?: number;
  readonly pendingTakedownCount: number;
  readonly strikeLifetimeDays: number;
  readonly warnings: readonly HealthStrike[];
  readonly strikes?: readonly HealthStrike[];
  readonly notices: readonly TakedownNotice[];
}
