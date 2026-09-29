import type { ID, ISODate } from "./models.type";
import type { Money } from "./money.type";

export interface LoyaltySummary {
  readonly points: number;
  readonly pointsValue: Money;
  readonly cashbackBalance: Money;
  readonly tierName: string;
  readonly pointsToNextTier: number | null;
  readonly nextTierName: string | null;
  readonly redeemableAtCheckout: boolean;
  readonly minimumPointsToRedeem: number;
  readonly howToEarn: readonly string[];
}

export type ReferralStatus = "invited" | "joined" | "first_order" | "rewarded";

export interface ReferralEntry {
  readonly id: ID;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly status: ReferralStatus;
  readonly reward: Money | null;
  readonly updatedAt: ISODate;
}

export interface ReferralSummary {
  readonly code: string;
  readonly shareUrl: string;
  readonly rewardForYou: Money;
  readonly rewardForFriend: Money;
  readonly totalEarned: Money;
  readonly rules: readonly string[];
  readonly referrals: readonly ReferralEntry[];
}
