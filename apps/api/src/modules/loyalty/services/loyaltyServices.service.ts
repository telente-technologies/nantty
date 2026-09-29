import type { CashbackService } from "./cashback.service.js";
import type { LoyaltyPointsService } from "./loyaltyPoints.service.js";
import type { LoyaltySummaryService } from "./loyaltySummary.service.js";
import type { OrderRewardsService } from "./orderRewards.service.js";
import type { ReferralsService } from "./referrals.service.js";

export interface LoyaltyServices {
  readonly points: LoyaltyPointsService;
  readonly cashback: CashbackService;
  readonly referrals: ReferralsService;
  readonly summary: LoyaltySummaryService;
  readonly orderRewards: OrderRewardsService;
}
