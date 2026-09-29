import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { CurrencyConverter } from "../../../interfaces/currencyConverter.interface.js";
import { Money } from "../../../utils/money.util.js";
import type { LoyaltySummaryDto, ReferralSummaryDto } from "../dtos/loyalty.dto.js";
import type { LoyaltyRewardRecord } from "../models/loyalty.model.js";
import type { LoyaltyPointsService } from "./loyaltyPoints.service.js";
import type { ReferralsService } from "./referrals.service.js";

const LOYALTY_TIERS = [
  { name: "Bronze", minimumPoints: 0 },
  { name: "Silver", minimumPoints: 1_000 },
  { name: "Gold", minimumPoints: 5_000 },
  { name: "Platinum", minimumPoints: 20_000 },
] as const;

export class LoyaltySummaryService {
  public constructor(private readonly points: LoyaltyPointsService, private readonly referrals: ReferralsService, private readonly currencyConverter: CurrencyConverter) {}

  public async buildLoyaltySummary(userId: string, displayCurrency: CurrencyCode): Promise<LoyaltySummaryDto> {
    const { settings, rewards } = this.points.dependencies;
    const [balance, lifetime, cashback] = await Promise.all([
      this.points.readPointBalance(userId),
      rewards.sumPointsEarned(userId),
      rewards.listRewardsOfKind(userId, "cashback"),
    ]);
    const tierIndex = LOYALTY_TIERS.reduce((current, tier, index) => (lifetime >= tier.minimumPoints ? index : current), 0);
    const nextTier = LOYALTY_TIERS[tierIndex + 1];
    const earnPercent = settings.loyalty.pointsEarnBps / 100;
    return {
      points: balance,
      pointsValue: Money.of(balance * settings.loyalty.pointValueMinor[displayCurrency], displayCurrency).toDto(),
      cashbackBalance: (await this.sumInCurrency(cashback, displayCurrency)).toDto(),
      tierName: LOYALTY_TIERS[tierIndex]?.name ?? "Bronze",
      pointsToNextTier: nextTier === undefined ? null : nextTier.minimumPoints - lifetime,
      nextTierName: nextTier?.name ?? null,
      redeemableAtCheckout: balance >= settings.loyalty.minimumPointsToRedeem,
      minimumPointsToRedeem: settings.loyalty.minimumPointsToRedeem,
      howToEarn: [
        `Earn points worth ${earnPercent}% of every completed order.`,
        "Get cashback on eligible stores and categories when your order is released to the seller.",
        "Invite friends: you both get a reward after their first completed order.",
      ],
    };
  }

  public async buildReferralSummary(userId: string, displayCurrency: CurrencyCode): Promise<ReferralSummaryDto> {
    const { settings, rewards } = this.points.dependencies;
    const code = await this.referrals.findOrCreateCode(userId);
    const referrals = (await this.referrals.listReferrals(userId)).filter((referral) => referral.status !== "rejected");
    const users = new Map((referrals.length === 0 ? [] : await this.referrals.ports.userDirectory.findUserSummaries(referrals.map((item) => item.refereeId))).map((user) => [user.id, user]));
    const reward = Money.of(settings.loyalty.referralRewardMinor[displayCurrency], displayCurrency).toDto();
    return {
      code,
      shareUrl: `${settings.loyalty.referralShareBaseUrl}/${code}`,
      rewardForYou: reward,
      rewardForFriend: reward,
      totalEarned: (await this.sumInCurrency(await rewards.listRewardsOfKind(userId, "referral_reward"), displayCurrency)).toDto(),
      rules: [
        "Share your code with friends who are new to Zudomart.",
        "You and your friend are both rewarded after their first order is completed.",
        "Self-referrals and suspicious activity are not rewarded.",
      ],
      referrals: referrals.map((referral) => ({
        id: referral.id,
        displayName: users.get(referral.refereeId)?.name ?? "Friend",
        avatarUrl: users.get(referral.refereeId)?.avatarUrl ?? null,
        status: referral.status === "rewarded" ? "rewarded" : "joined",
        reward: referral.rewardAmount === null || referral.rewardCurrency === null ? null : Money.of(referral.rewardAmount, referral.rewardCurrency).toDto(),
        updatedAt: referral.updatedAt.toISOString(),
      })),
    };
  }

  private async sumInCurrency(records: readonly LoyaltyRewardRecord[], currency: CurrencyCode): Promise<Money> {
    let total = Money.zero(currency);
    for (const record of records) {
      if (record.currency === null) continue;
      total = total.add((await this.currencyConverter.convertMoney(Money.of(record.amount, record.currency), currency)).money);
    }
    return total;
  }
}
