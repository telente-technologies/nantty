export interface SellerAccountHealth {
  readonly status: "GOOD_STANDING" | "AT_RISK" | "RESTRICTED";
  readonly restrictions: readonly ("MONETISATION" | "GOING_LIVE")[];
  readonly canMonetise: boolean;
  readonly canGoLive: boolean;
  readonly activeStrikeCount: number;
  readonly restrictionThreshold: number;
  readonly pendingTakedownCount: number;
  readonly strikeLifetimeDays: number;
}
