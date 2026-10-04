export type AccountStanding = "GOOD_STANDING" | "AT_RISK" | "RESTRICTED";

export interface AccountHealthSummary {
  readonly status: AccountStanding;
  readonly restrictions: readonly ("MONETISATION" | "GOING_LIVE")[];
  readonly canMonetise: boolean;
  readonly canGoLive: boolean;
  readonly activeStrikeCount: number;
  readonly restrictionThreshold: number;
  readonly pendingTakedownCount: number;
  readonly strikeLifetimeDays: number;
  readonly warnings: readonly unknown[];
  readonly notices: readonly { readonly claimId: string; readonly state: string; readonly deadlineAt: string | null }[];
}
