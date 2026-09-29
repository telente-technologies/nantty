import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { MinorUnits } from "../../../types/money.type.js";

export type LoyaltyRewardKind = "points_earned" | "points_redeemed" | "points_restored" | "cashback" | "referral_reward";

export interface LoyaltyRewardRecord {
  readonly id: string;
  readonly userId: string;
  readonly kind: LoyaltyRewardKind;
  readonly reference: string;
  readonly points: number;
  readonly amount: MinorUnits;
  readonly currency: CurrencyCode | null;
  readonly orderId: string | null;
  readonly description: string;
  readonly createdAt: Date;
}

export type NewLoyaltyReward = Omit<LoyaltyRewardRecord, "id">;

export type PointsRedemptionStatus = "held" | "released" | "consumed";

export interface PointsRedemptionRecord {
  readonly checkoutId: string;
  readonly userId: string;
  readonly points: number;
  readonly discount: MinorUnits;
  readonly currency: CurrencyCode;
  readonly status: PointsRedemptionStatus;
  readonly createdAt: Date;
}

export type ReferralStatus = "joined" | "rewarded" | "rejected";

export interface ReferralRecord {
  readonly id: string;
  readonly referrerId: string;
  readonly refereeId: string;
  readonly code: string;
  readonly status: ReferralStatus;
  readonly rejectionReason: string | null;
  readonly rewardAmount: MinorUnits | null;
  readonly rewardCurrency: CurrencyCode | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type NewReferral = Pick<ReferralRecord, "referrerId" | "refereeId" | "code" | "status" | "rejectionReason" | "createdAt">;

export interface CashbackPromoRecord {
  readonly id: string;
  readonly storeId: string | null;
  readonly categoryId: string | null;
  readonly rateBps: number;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly active: boolean;
  readonly createdById: string;
  readonly createdAt: Date;
}

export type NewCashbackPromo = Omit<CashbackPromoRecord, "id">;

export interface RewardableOrderItem {
  readonly productId: string;
  readonly categoryId: string | null;
  readonly lineTotal: MinorUnits;
}

export interface RewardableOrder {
  readonly id: string;
  readonly buyerId: string;
  readonly storeId: string;
  readonly currency: CurrencyCode;
  readonly total: MinorUnits;
  readonly items: readonly RewardableOrderItem[];
}
