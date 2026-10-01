import type { LoyaltySummary, ReferralSummary } from "@/types/rewards.type";

import { demoFanAccount, getSignedInMockUser, isoDateHoursAgo } from "./fixtures.mock";
import { convertUsdCentsToViewerCurrency } from "./locale.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { findDirectoryUserById } from "./userDirectory.mock";

const USD_CENTS_PER_POINT = 1;

export const loyaltyPointsForSignedInUser = () => (getSignedInMockUser().id === demoFanAccount.id ? 420 : 2_380);

const buildLoyaltySummary = (): LoyaltySummary => {
  const points = loyaltyPointsForSignedInUser();
  return {
    points,
    pointsValue: convertUsdCentsToViewerCurrency(points * USD_CENTS_PER_POINT),
    cashbackBalance: convertUsdCentsToViewerCurrency(points > 1000 ? 740 : 120),
    tierName: points > 2000 ? "Gold" : "Silver",
    pointsToNextTier: points > 2000 ? 2_620 : 1_580,
    nextTierName: points > 2000 ? "Platinum" : "Gold",
    redeemableAtCheckout: points >= 200,
    minimumPointsToRedeem: 200,
    howToEarn: [
      "Earn 1 point for every dollar-equivalent you spend once you confirm receipt",
      "Get cashback on selected stores during Sales of the Day",
      "Earn bonus points when friends you invite place their first order",
    ],
  };
};

const referralEntry = (id: string, userId: string, status: ReferralSummary["referrals"][number]["status"], hoursAgo: number, rewarded: boolean) => {
  const user = findDirectoryUserById(userId)!;
  return { id, displayName: user.name, avatarUrl: user.avatarUrl, status, reward: rewarded ? convertUsdCentsToViewerCurrency(300) : null, updatedAt: isoDateHoursAgo(hoursAgo) };
};

const buildReferralSummary = (): ReferralSummary => {
  const user = getSignedInMockUser();
  const code = `${user.username.split(".")[0]!.toUpperCase().slice(0, 6)}${user.id === demoFanAccount.id ? "21" : "88"}`;
  const referrals = user.id === demoFanAccount.id
    ? [referralEntry("rf_4", "u_14", "invited", 20, false)]
    : [referralEntry("rf_1", "u_17", "rewarded", 300, true), referralEntry("rf_2", "u_20", "first_order", 60, false), referralEntry("rf_3", "u_24", "joined", 12, false)];
  return {
    code,
    shareUrl: `https://zudomart.com/invite/${code}`,
    rewardForYou: convertUsdCentsToViewerCurrency(300),
    rewardForFriend: convertUsdCentsToViewerCurrency(200),
    totalEarned: convertUsdCentsToViewerCurrency(referrals.filter((entry) => entry.reward).length * 300),
    rules: [
      "Your friend gets a discount on their first order when they sign up with your code.",
      "You get your reward once their first order is confirmed as received.",
      "Rewards land in your Zudomart wallet as cashback.",
    ],
    referrals,
  };
};

export const rewardsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/loyalty/me", () => buildLoyaltySummary()),
  createMockRoute("GET", "/api/v1/referrals/me", () => buildReferralSummary()),
];
