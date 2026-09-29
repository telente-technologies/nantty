import type { MoneyDto } from "../../../utils/money.util.js";
import { Money } from "../../../utils/money.util.js";
import type { CashbackPromoRecord, LoyaltyRewardRecord } from "../models/loyalty.model.js";

export interface LoyaltySummaryDto {
  readonly points: number;
  readonly pointsValue: MoneyDto;
  readonly cashbackBalance: MoneyDto;
  readonly tierName: string;
  readonly pointsToNextTier: number | null;
  readonly nextTierName: string | null;
  readonly redeemableAtCheckout: boolean;
  readonly minimumPointsToRedeem: number;
  readonly howToEarn: readonly string[];
}

export interface ReferralEntryDto {
  readonly id: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly status: "invited" | "joined" | "first_order" | "rewarded";
  readonly reward: MoneyDto | null;
  readonly updatedAt: string;
}

export interface ReferralSummaryDto {
  readonly code: string;
  readonly shareUrl: string;
  readonly rewardForYou: MoneyDto;
  readonly rewardForFriend: MoneyDto;
  readonly totalEarned: MoneyDto;
  readonly rules: readonly string[];
  readonly referrals: readonly ReferralEntryDto[];
}

export function convertLoyaltyRewardToDto(reward: LoyaltyRewardRecord) {
  return {
    id: reward.id,
    kind: reward.kind,
    points: reward.points,
    amount: reward.currency === null ? null : Money.of(reward.amount, reward.currency).toDto(),
    orderId: reward.orderId,
    description: reward.description,
    createdAt: reward.createdAt.toISOString(),
  };
}

export function convertCashbackPromoToDto(promo: CashbackPromoRecord) {
  return {
    id: promo.id,
    storeId: promo.storeId,
    categoryId: promo.categoryId,
    rateBps: promo.rateBps,
    ratePercent: promo.rateBps / 100,
    startsAt: promo.startsAt.toISOString(),
    endsAt: promo.endsAt?.toISOString() ?? null,
    active: promo.active,
  };
}
